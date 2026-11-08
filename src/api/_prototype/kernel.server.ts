// PROTOTYPE. Shared plumbing every API class inherits: policy enforcement,
// the one place errors are logged/translated, and the tx() helper.
import { prismaClient } from "@/lib/db";
import type { Prisma, PrismaClient } from "@/lib/prisma/client";
import { type SessionUser, useAppSession } from "@/lib/session";
import { compareRoles } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { AuditJournal } from "./journal.server";
import { type Notifier, notifier } from "./notifier.server";

// ---- context (decided: { db, user|null, notifier }) -----------------------
export type Ctx = {
	db: PrismaClient;
	user: SessionUser | null;
	notifier: Notifier;
};

export const buildContext = async (): Promise<Ctx> => {
	const { data } = await useAppSession();
	return {
		db: prismaClient,
		notifier,
		user: data.id ? (data as SessionUser) : null,
	};
};

// ---- errors (decided: ApiError family; only the message crosses the wire) --
export class ApiError extends Error {}
export class ForbiddenError extends ApiError {
	constructor() {
		super(m.common_unauthorized());
	}
}
export class NotFoundError extends ApiError {}
export class ConflictError extends ApiError {}

// ---- policy (decided: table on the class, exhaustive via `satisfies`) -----
export type Policy = "PUBLIC" | "AUTHENTICATED" | "EDITOR" | "ADMIN";
export type Policies<T> = {
	[K in keyof T as T[K] extends (...a: never[]) => unknown ? K : never]: Policy;
};

const allowed = (policy: Policy, user: SessionUser | null) => {
	if (policy === "PUBLIC") return true;
	if (!user?.id) return false;
	if (policy === "AUTHENTICATED") return true;
	return compareRoles(user.role, policy) !== -1;
};

export abstract class ApiBase {
	// Returning a Proxy from the constructor lets one wrapper do the policy
	// check + log-and-translate for every public method, so bodies have neither.
	constructor(protected readonly ctx: Ctx) {
		const policy = (new.target as unknown as { policy: Record<string, Policy> })
			.policy;
		const name = new.target.name;
		return new Proxy(this, {
			get: (target, prop, receiver) => {
				const value = Reflect.get(target, prop, receiver);
				const required = typeof prop === "string" ? policy[prop] : undefined;
				if (typeof value !== "function" || !required) return value;
				return async (...args: unknown[]) => {
					if (!allowed(required, ctx.user)) throw new ForbiddenError();
					try {
						// apply to the raw target: internal this.x() calls skip re-checks
						return await value.apply(target, args);
					} catch (e) {
						if (e instanceof ApiError) throw e; // expected: not logged as failure
						console.error(`[${name}.${String(prop)}]`, ctx.user?.id, e);
						// real: new key m.common_something_went_wrong()
						throw new Error("Etwas ist schiefgelaufen");
					}
				};
			},
		});
	}

	protected tx<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
		return this.ctx.db.$transaction(fn);
	}

	protected journal(tx: Prisma.TransactionClient) {
		return new AuditJournal(tx, this.ctx.user?.id ?? null);
	}

	// row-level helper (decided: stays in bodies, not in the policy table)
	protected isAtLeast(role: "EDITOR" | "ADMIN") {
		return allowed(role, this.ctx.user);
	}
}

// ---- handler side (decided: server fns stay one-liners, `ok` adds message) --
export const ok = <T>(message: string, data: T) => ({ data, message });

export const run = async <A extends ApiBase, T>(
	Api: new (ctx: Ctx) => A,
	message: () => string,
	call: (api: A) => Promise<T>,
) => ok(message(), await call(new Api(await buildContext())));
