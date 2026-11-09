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

// The request's session cookie, as a port so classes (login, invitation
// accept, password reset) can sign a user in or out without touching the
// framework, and tests can record what was stored.
export type SessionStore = {
	// Replaces the session's contents with exactly these fields.
	update: (user: SessionUser) => Promise<void>;
	clear: () => Promise<void>;
};

export type ApiContext = {
	db: PrismaClient;
	user: SessionUser | null;
	session: SessionStore;
};

export const buildContext = async (): Promise<ApiContext> => {
	const session = await useAppSession();
	return {
		db: prismaClient,
		session: {
			clear: async () => {
				await session.clear();
			},
			// h3 merges updates into the existing data; drop every old key first
			// so only SessionUser fields (never a credential) are stored.
			update: async ({ id, name, role, userName }) => {
				await session.update((data) => {
					for (const key of Object.keys(data)) {
						delete (data as Record<string, unknown>)[key];
					}
					return { id, name, role, userName };
				});
			},
		},
		user: session.data.id ? (session.data as SessionUser) : null,
	};
};

// For callers outside a server function that must not touch the session
// cookie at all (the iCal feed route: calendar clients send no cookie, and
// reading the session would set one).
const noSession: SessionStore = {
	clear: () => Promise.reject(new Error("No session in this context")),
	update: () => Promise.reject(new Error("No session in this context")),
};
export const anonymousContext = (): ApiContext => ({
	db: prismaClient,
	session: noSession,
	user: null,
});

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

	// For AUTHENTICATED (or stricter) methods, where the policy already
	// guarantees an actor; this only narrows the type.
	protected get requiredActorId(): string {
		const id = this.actorId;
		if (!id) throw new Error("Policy-protected method called without an actor");
		return id;
	}

	// For role-dependent output inside a method (e.g. which fields an actor may
	// see); access to the method itself belongs in the policy table.
	protected isAtLeast(role: Exclude<Policy, "PUBLIC">) {
		return isAllowed(role, this.ctx.user);
	}

	// Row-level rule: the acting user themselves, or at least `role`.
	protected requireSelfOrRole(userId: string, role: Exclude<Policy, "PUBLIC">) {
		const user = this.ctx.user;
		if (user?.id === userId) return;
		if (!isAllowed(role, user)) throw new ForbiddenError();
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
