import { tokenUserSelect } from "@/lib/users";
import { isInvitationExpired } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import {
	ApiBase,
	ApiError,
	NotFoundError,
	type Policies,
	type Tx,
} from "./kernel.server";
import { requireUser, setPassword } from "./users.domain.server";

export class InvitationsApi extends ApiBase {
	static readonly policy = {
		accept: "PUBLIC",
		create: "ADMIN",
		get: "PUBLIC",
	} as const satisfies Policies<InvitationsApi>;

	// Token read for the invite page: only what it shows.
	async get(id: string) {
		const { userId: _, ...view } = await this.requireOpenInvitation(
			this.ctx.db,
			id,
		);
		return view;
	}

	// Replaces any previous invitation, so only the newest link works.
	async create(userId: string) {
		return this.tx(async (tx) => {
			await requireUser(tx, userId);
			await tx.userInvitation.deleteMany({ where: { userId } });
			return tx.userInvitation.create({ data: { userId } });
		});
	}

	// Sets the invited user's first password, consumes the token and signs
	// them in.
	async accept(id: string, password: string, confirmPassword: string) {
		const user = await this.tx(async (tx) => {
			const invitation = await this.requireOpenInvitation(tx, id);
			const user = await setPassword(
				tx,
				invitation.userId,
				password,
				confirmPassword,
			);
			await tx.userInvitation.delete({ where: { id } });
			return user;
		});
		await this.ctx.session.update(user);
		return user;
	}

	private async requireOpenInvitation(tx: Tx, id: string) {
		const invitation = await tx.userInvitation.findUnique({
			select: {
				createdAt: true,
				id: true,
				user: { select: tokenUserSelect },
				userId: true,
			},
			where: { id },
		});
		if (!invitation) throw new NotFoundError(m.common_invitation_not_found());
		if (isInvitationExpired(invitation)) {
			throw new ApiError(m.common_invitation_expired());
		}
		return invitation;
	}
}
