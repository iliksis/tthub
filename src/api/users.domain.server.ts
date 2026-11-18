// Shared by UsersApi, InvitationsApi and PasswordResetApi (ADR 0004: classes
// never call each other; shared DB logic is a plain function taking a tx).
import { hashPassword } from "@/lib/db";
import { userViewSelect } from "@/lib/users";
import { m } from "@/paraglide/messages";
import { ApiError, NotFoundError, type Tx } from "./kernel.server";

export const requirePasswordsMatch = (
	password: string,
	confirmPassword: string,
) => {
	if (password !== confirmPassword) {
		throw new ApiError(m.common_the_passwords_entered_do_not_match());
	}
};

export const requireUser = async (tx: Tx, userId: string) => {
	const user = await tx.user.findUnique({
		select: userViewSelect,
		where: { id: userId },
	});
	if (!user) throw new NotFoundError(m.users_user_not_found());
	return user;
};

// Sets a new password and returns the credential-free user view.
export const setPassword = async (
	tx: Tx,
	userId: string,
	password: string,
	confirmPassword: string,
) => {
	requirePasswordsMatch(password, confirmPassword);
	return tx.user.update({
		data: { password: await hashPassword(password) },
		select: userViewSelect,
		where: { id: userId },
	});
};
