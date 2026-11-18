// The explicit view of a User that API classes may return or store in the
// session: never the credential (`password`) field. Use as a Prisma `select`.
export const userViewSelect = {
	id: true,
	name: true,
	role: true,
	userName: true,
} as const;

// What a token page (invitation, password reset) needs about its user.
export const tokenUserSelect = { userName: true } as const;
