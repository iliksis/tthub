import type { ApiBase, ApiContext } from "@/api/kernel.server";
import type { SessionUser } from "@/lib/session";
import { createFakeSession } from "./fakeSession";
import { createTestDb } from "./testDb";

type Role = SessionUser["role"];

// Builds a real API class against a fresh migrated SQLite DB (ADR 0004
// testing strategy). `role: null` gives an anonymous caller; otherwise a User
// row of that role is seeded so the actor is a real foreign-key target.
// Always `await cleanup()` (e.g. in afterEach): it disconnects Prisma before
// deleting the DB file, which Windows otherwise refuses to remove.
export async function createTestApi<A extends ApiBase>(
	Api: new (ctx: ApiContext) => A,
	{ role }: { role: Role | null },
) {
	const testDb = createTestDb();
	const db = testDb.prisma;
	let user: SessionUser | null = null;
	if (role) {
		const row = await db.user.create({
			data: { name: `Test ${role}`, role, userName: `test-${role}` },
		});
		user = {
			id: row.id,
			name: row.name,
			role: row.role,
			userName: row.userName,
		};
	}
	const session = createFakeSession(user);
	return {
		api: new Api({ db, session: session.store, user }),
		cleanup: async () => {
			await db.$disconnect();
			testDb.close();
		},
		db,
		// What the class stored in (or cleared from) the session cookie.
		session: session.state,
		user,
	};
}
