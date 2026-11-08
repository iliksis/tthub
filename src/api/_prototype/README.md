# PROTOTYPE - throwaway, do not merge

Question: with the decisions on the wayfinder map "API classes for server logic"
(#95), are class method bodies really tiny, and are the signatures pleasant?

This is a type-checked *code-shape* sketch, not a UI or state-machine demo.
Not wired into the app; the real schema still has `Transaction` where the real
design says `AuditLog` (see journal.server.ts).

Read in this order: handlers.ts (what a server fn becomes) ->
appointments.server.ts (the class) -> kernel.server.ts (policy/errors/tx) ->
journal.server.ts.
