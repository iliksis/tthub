import { tokenUserSelect } from "@/lib/users";
import { m } from "@/paraglide/messages";
import {
	ApiBase,
	NotFoundError,
	type Policies,
	type Tx,
} from "./kernel.server";
import { requireUser, setPassword } from "./users.domain.server";

export class PasswordResetApi extends ApiBase {
	static readonly policy = {
		complete: "PUBLIC",
		create: "ADMIN",
		get: "PUBLIC",
	} as const satisfies Policies<PasswordResetApi>;

	// Token read for the reset page: only what it shows.
	async get(id: string) {
		const { userId: _, ...view } = await this.requireReset(this.ctx.db, id);
		return view;
	}

	// Replaces any previous reset, so only the newest link works.
	async create(userId: string) {
		return this.tx(async (tx) => {
			await requireUser(tx, userId);
			await tx.passwordReset.deleteMany({ where: { userId } });
			return tx.passwordReset.create({ data: { userId } });
		});
	}

	// Sets the new password, consumes the token and signs the user in.
	async complete(id: string, password: string, confirmPassword: string) {
		const user = await this.tx(async (tx) => {
			const reset = await this.requireReset(tx, id);
			const user = await setPassword(
				tx,
				reset.userId,
				password,
				confirmPassword,
			);
			await tx.passwordReset.delete({ where: { id } });
			return user;
		});
		await this.ctx.session.update(user);
		return user;
	}

	private async requireReset(tx: Tx, id: string) {
		const reset = await tx.passwordReset.findUnique({
			select: {
				createdAt: true,
				id: true,
				user: { select: tokenUserSelect },
				userId: true,
			},
			where: { id },
		});
		if (!reset) {
			throw new NotFoundError(m.common_password_reset_request_not_found());
		}
		return reset;
	}
}
