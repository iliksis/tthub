# Audit Log Is Entity-Agnostic

The change journal (`Transaction`, with a required `appointmentId` FK) could only describe Appointments, and its name collided with database transactions. We replace it with one `AuditLog` table (`entityType`, `entityId`, `userId?`, `action`, `changes?` JSON) with no FK to the entity, so a new journalled entity needs no schema change.

**Considered:** per-entity nullable FKs (keeps referential integrity and Prisma `include`, but needs a migration per entity) and one journal table per entity. Rejected for the cost of change per new entity.

**Consequences:**
- No FK integrity and no `include`: readers resolve entities per `entityType` in code (appointments soft-delete, so they always resolve; unknown entities fall back to the id).
- Only Appointments are journalled at launch; existing rows are copied by a single SQLite migration (`entityType = 'Appointment'`), so a production backup comes first and the migration is tested against seeded old rows.
- `Transaction`/`TransactionType` become `AuditLog`/`AuditAction`; the journal UI (route, `TransactionHistory`, `TransactionDetail`, dashboard) changes accordingly, the one exception to "consumers don't change" in ADR 0004.
