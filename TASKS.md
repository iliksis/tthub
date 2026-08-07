# Tasks

Findings from `/code-review` on branch `design-rework` (2026-08-07).

## Open

- [x] **`deleteUser` FK-constraint crash** — `src/api/users.ts:213`
  `deleteUser` never removes the user's `Transaction` audit-log rows before deleting the `User`, and `Transaction.userId` has no cascade delete. Deleting any user who ever authored an appointment mutation (create/edit/publish/delete, per the audit-log pattern in CLAUDE.md) throws a raw SQLite FK violation, caught generically and returned as an untranslated Prisma error string — the user can never be deleted. (Note: the transaction entry obviously shouldn't be deleted)
  Fixed: `Transaction.userId`/`user` made optional with `onDelete: SetNull` (migration `20260807185424_transaction_user_optional`), so deleting a user nulls out their past `Transaction` rows instead of failing the FK check and instead of deleting the audit rows. Updated `journal.tsx`, `JournalMobileRow.tsx`, `TransactionDetail.tsx`, and `TransactionHistory.tsx` to render a "Deleted user" placeholder (new `t()` key) when `transaction.user` is null.

- [ ] **Bulk delete has no confirmation dialog** — `src/routes/_authed/appts/index.tsx:669` (wired at line 762)
  The new split-view's bulk "Delete" action fires immediately with no confirmation, unlike the single-appointment delete flow which still goes through `DeleteModal`. An editor multi-selecting several appointments and clicking Delete soft-deletes them all on one click/misclick.

- [ ] **Stale closure in search debounce reverts filter changes** — `src/components/appointments/List.tsx:301`
  The debounced search-query effect depends only on `[queryInput]` and reads `navigate`/props from a closure that goes stale. Typing a search term then changing the Type/Response filter within the 300ms debounce window causes the delayed `navigate()` call to revert the just-picked filter back to its previously captured value.

- [ ] **Same stale-closure debounce bug in journal search** — `src/routes/_authed/appts/journal.tsx:227`
  Identical issue to List.tsx: the effect depends only on `[queryInput]` but reads `search.sort`/`search.type` from the render closure at schedule time, so a quick filter/sort change gets overwritten by the pending debounced navigate.

- [ ] **Ctrl+K global search removed with no replacement** — `src/routes/__root.tsx`
  `GlobalSearch.tsx` and its `CommandModal` were deleted with no replacement wired up. `src/components/ui/command.tsx` (`CommandDialog`) exists but is never imported or mounted anywhere — pressing Ctrl/Cmd+K now does nothing. (Note: remove the commandModal)

- [ ] **Team fetch failure leaves permanent loading spinner** — `src/hooks/useTeamDetail.ts:20`
  `getTeamServerFn`'s promise chain has no `.catch`, and on a >=400 response the hook leaves `team` undefined with no error state, so `TeamsSplitView`'s `isLoading || !team` spinner never clears into an error UI. On outright promise rejection, `isLoading` never even flips to `false` since `setIsLoading(false)` lives only inside the `.then` callback.

## Refuted (no action needed)

- ~~Silent edit discard in `PlacementsSheet.tsx`~~ — actually covered by an `onBlur={() => commitEdit(p)}` handler.
- ~~3x-duplicated diff logic in `appointments.ts`~~ — only occurs once in the code.

## Out of scope (pre-existing, not introduced by this branch)

- Client-only self-role-change/self-delete guard in `users.ts`.
- Missing expiry check on password-reset tokens.
