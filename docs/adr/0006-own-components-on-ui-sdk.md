# Own Components on ui-sdk Instead of shadcn/base-ui

The UI primitives in `src/components/ui` are shadcn/ui (new-york) copies on top of `@base-ui/react`. We migrate them to our own components built on `@ui-sdk/react` and `@ui-sdk/core`, one PR at a time, off a long-lived feature branch (parent issue #157).

**Considered:** staying on shadcn/base-ui (no migration cost, but the primitives stay copy-pasted code we own without the behaviour layer ui-sdk provides). Rejected in favour of headless behaviours we compose into components with our own styling.

**Consequences:**
- `@ui-sdk/react` and `@ui-sdk/core` are pinned to the same exact version (no caret; both are beta, so any bump is deliberate and done for both together).
- ui-sdk's `web.css` is not imported: styling stays Tailwind v4 plus Catppuccin.
- Migration is complete: `@base-ui/react`, `sonner` and `components.json` are removed. Migrated components keep their public props so consumers don't change.
- The ui-sdk docs ship in `node_modules` and are the reference for building components (see CLAUDE.md).
