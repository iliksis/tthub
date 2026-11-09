// Shared plumbing every API class inherits (ADR 0004): per-method policy
// enforcement, the single place unexpected errors are logged and translated,
// and the `tx()` helper. Server functions in `src/api/<aggregate>.ts` stay
// one-liners that hand a context-built class to `run`.
import { prismaClient } from "@/lib/db";
import type { Prisma, PrismaClient } from "@/lib/prisma/client";
import { type SessionUser, useAppSession } from "@/lib/session";
import { compareRoles } from "@/lib/utils";
import { m } from "@/paraglide/messages";

// ---- context ---------------------------------------------------------------
export type Tx = Prisma.TransactionClient;

export type ApiContext = {
	db: PrismaClient;
	user: SessionUser | null;
};

export const buildContext = async (): Promise<ApiContext> => {
	const { data } = await useAppSession();
	return {
		db: prismaClient,
		user: data.id ? (data as SessionUser) : null,
	};
};

// ---- errors ----------------------------------------------------------------
// Expected failures. Their message is user-facing and crosses the wire as-is;
// anything else thrown from a method is logged and replaced by a generic text.
export class ApiError extends Error {}
export class ForbiddenError extends ApiError {
	constructor() {
		super(m.common_unauthorized());
	}
}
export class NotFoundError extends ApiError {}
export class ConflictError extends ApiError {}

// ---- policy ----------------------------------------------------------------
export type Policy = "PUBLIC" | "AUTHENTICATED" | "EDITOR" | "ADMIN";

// Every public method of T needs an entry; use with `as const satisfies`.
export type Policies<T> = {
	[K in keyof T as T[K] extends (...args: never[]) => unknown
		? K
		: never]: Policy;
};

const isAllowed = (policy: Policy, user: SessionUser | null) => {
	if (policy === "PUBLIC") return true;
	if (!user?.id) return false;
	if (policy === "AUTHENTICATED") return true;
	return compareRoles(user.role, policy) !== -1;
};

export abstract class ApiBase {
	// Returning a Proxy from the constructor lets one wrapper do the policy
	// check and log-and-translate for every policy-listed method, so method
	// bodies contain neither. Methods are applied to the raw target, so
	// internal `this.x()` calls skip the check (see ADR 0004).
	constructor(protected readonly ctx: ApiContext) {
		const name = new.target.name;
		const policy = (
			new.target as unknown as { policy?: Record<string, Policy> }
		).policy;
		if (!policy) {
			throw new Error(`${name} must declare a static policy table`);
		}
		// biome-ignore lint/correctness/noConstructorReturn: the Proxy is the point
		return new Proxy(this, {
			get: (target, prop, receiver) => {
				const value = Reflect.get(target, prop, receiver);
				if (
					typeof value !== "function" ||
					typeof prop !== "string" ||
					!Object.hasOwn(policy, prop)
				) {
					return value;
				}
				const required = policy[prop];
				return async (...args: unknown[]) => {
					if (!isAllowed(required, ctx.user)) throw new ForbiddenError();
					try {
						return await value.apply(target, args);
					} catch (e) {
						if (e instanceof ApiError) throw e;
						console.error(`[${name}.${prop}]`, ctx.user?.id ?? null, e);
						throw new Error(m.common_something_went_wrong());
					}
				};
			},
		});
	}

	protected get actorId(): string | null {
		return this.ctx.user?.id ?? null;
	}

	protected tx<T>(fn: (tx: Tx) => Promise<T>) {
		return this.ctx.db.$transaction(fn);
	}
}

// ---- handler side ------------------------------------------------------------
export const ok = <T>(message: string, data: T) => ({ data, message });

export const run = async <A extends ApiBase, T>(
	Api: new (ctx: ApiContext) => A,
	message: () => string,
	call: (api: A) => Promise<T>,
) => ok(message(), await call(new Api(await buildContext())));
