import { hashPassword } from "@/lib/db";
import type { Role } from "@/lib/prisma/enums";
import { userViewSelect } from "@/lib/users";
import { m } from "@/paraglide/messages";
import {
	ApiBase,
	ApiError,
	ConflictError,
	type Policies,
} from "./kernel.server";
import { requirePasswordsMatch, requireUser } from "./users.domain.server";

export type CreateUserInput = { userName: string; name: string; role: Role };
export type UserInformationInput = {
	id: string;
	name: string;
	password: string;
	confirmPassword: string;
};

export class UsersApi extends ApiBase {
	static readonly policy = {
		create: "ADMIN",
		delete: "ADMIN",
		list: "ADMIN",
		updateInformation: "AUTHENTICATED",
		updateRole: "ADMIN",
	} as const satisfies Policies<UsersApi>;

	async list() {
		return this.ctx.db.user.findMany({
			select: { ...userViewSelect, invitation: true, passwordReset: true },
		});
	}

	// New users get an invitation right away; they set their password by
	// accepting it.
	async create({ name, role, userName }: CreateUserInput) {
		return this.tx(async (tx) => {
			if (await tx.user.count({ where: { userName } })) {
				throw new ConflictError(m.users_user_name_taken());
			}
			return tx.user.create({
				data: { invitation: { create: {} }, name, role, userName },
				select: userViewSelect,
			});
		});
	}

	async updateRole(id: string, role: Role) {
		if (id === this.actorId) {
			throw new ApiError(m.users_you_cannot_change_your_own_role());
		}
		return this.tx(async (tx) => {
			await requireUser(tx, id);
			return tx.user.update({
				data: { role },
				select: userViewSelect,
				where: { id },
			});
		});
	}

	// Own profile, or any profile as ADMIN. An empty password leaves the
	// current one in place (the profile form submits name-only changes).
	async updateInformation({
		confirmPassword,
		id,
		name,
		password,
	}: UserInformationInput) {
		this.requireSelfOrRole(id, "ADMIN");
		requirePasswordsMatch(password, confirmPassword);
		const hashed = password ? await hashPassword(password) : undefined;
		return this.tx(async (tx) => {
			await requireUser(tx, id);
			return tx.user.update({
				data: { name, password: hashed },
				select: userViewSelect,
				where: { id },
			});
		});
	}

	// Removes the rows that reference the user without a cascade, then the
	// user. Audit log rows keep the entry with a null actor (SetNull).
	async delete(userId: string) {
		await this.tx(async (tx) => {
			await requireUser(tx, userId);
			await tx.notificationSettings.deleteMany({
				where: { OR: [{ userId }, { subscription: { userId } }] },
			});
			await tx.subscription.deleteMany({ where: { userId } });
			await tx.response.deleteMany({ where: { userId } });
			await tx.userInvitation.deleteMany({ where: { userId } });
			await tx.passwordReset.deleteMany({ where: { userId } });
			await tx.user.delete({ where: { id: userId } });
		});
		return null;
	}
}
