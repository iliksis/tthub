import { hashPassword } from "@/lib/db";
import { userViewSelect } from "@/lib/users";
import { m } from "@/paraglide/messages";
import { ApiBase, ApiError, type Policies } from "./kernel.server";

export class AuthApi extends ApiBase {
	static readonly policy = {
		currentUser: "PUBLIC",
		login: "PUBLIC",
		logout: "PUBLIC",
	} as const satisfies Policies<AuthApi>;

	async login(userName: string, password: string) {
		const row = await this.ctx.db.user.findUnique({
			select: { ...userViewSelect, password: true },
			where: { userName },
		});
		if (!row?.password || row.password !== (await hashPassword(password))) {
			await this.ctx.session.clear();
			throw new ApiError(m.auth_incorrect_user_name_or_password());
		}
		const { password: _, ...user } = row;
		await this.ctx.session.update(user);
		return user;
	}

	async logout() {
		await this.ctx.session.clear();
		return null;
	}

	// The session user, as long as their account still exists (a deleted user's
	// cookie stops counting as signed in).
	async currentUser() {
		const user = this.ctx.user;
		if (!user) return null;
		const exists = await this.ctx.db.user.count({ where: { id: user.id } });
		return exists ? user : null;
	}
}
