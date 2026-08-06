# UI Style Guide

Design conventions distilled from the pages already migrated from daisyUI to shadcn/ui + Catppuccin on `design-rework`. When building new UI or touching an already-refactored page, match these patterns instead of inventing new ones or copying from a page that hasn't been migrated yet.

**Reference pages** (fully refactored — copy patterns from these): `src/routes/_authed/appts/index.tsx`, `src/routes/_authed/appts/$apptId.tsx`, `src/routes/_authed/appts/journal.tsx`, `src/routes/_authed/index.tsx`, `src/routes/_authed/players/$playerId.tsx`, `src/routes/_authed/teams/$teamId.tsx`, `src/components/appointments/PendingPile.tsx`, `src/components/calendar/*`, `src/components/settings/Profile.tsx` / `Notifications.tsx`.

Not every page is migrated yet — if a file still uses daisyUI classes (`btn`, `alert`, native `<dialog>`, `modal-box`, etc.), it's legacy and should not be used as a reference.

## 1. Foundations

- **Stack**: Tailwind v4 (config-less, `@theme inline` in `src/styles.css`), shadcn/ui "new-york" style, Catppuccin Latte (light) / Macchiato (dark) via `@catppuccin/tailwindcss`.
- **Dark mode**: class-based, via `@custom-variant dark (&:where(.dark, .dark *))` / `@custom-variant light (...)` — not `prefers-color-scheme`. Toggling happens by adding `.dark`/`.light` to an ancestor.
- **Icons**: `lucide-react` exclusively. Do not add another icon package. Unsized icons default to `size-4` (set on Button via `[&_svg:not([class*='size-'])]:size-4`); Badge icons default to `size-3`.
- **Motion**: no animation library (no framer-motion, react-spring, gsap). Use CSS transitions, `tw-animate-css`'s `animate-in`/`animate-out` (driven by Radix `data-[state=]` attributes), or — for drag interactions like `PendingPile` — raw `PointerEvent` handlers with inline `style={{ transform, opacity }}` plus a `transition-all duration-200 ease-out` class that's conditionally removed while actively dragging.
- **Font**: no custom `font-family` is set anywhere — default stack. Don't add one without discussion.
- **Class merging**: always use `cn()` from `@/lib/utils` for conditional classes, never string concatenation.

### Color tokens (`src/styles.css`)

Registered via `@theme inline` as `hsl(var(--token))`, so use them as normal Tailwind utilities (`bg-primary`, `text-muted-foreground`, etc.), never raw hex or default Tailwind palette colors (`bg-red-500`) for semantic meaning:

`background`, `foreground`, `card` (+`-foreground`), `popover` (+`-foreground`), `primary` (+`-foreground`), `secondary` (+`-foreground`), `muted` (+`-foreground`), `accent` (+`-foreground`), `destructive` (+`-foreground`), **`success`** (+`-foreground`), **`warning`** (+`-foreground`), **`info`** (+`-foreground`), `border`, `input`, `ring`, `chart-1`..`chart-5`, `sidebar` (+`-foreground`/`-primary`/`-primary-foreground`/`-accent`/`-accent-foreground`/`-border`/`-ring`).

`success`/`warning`/`info` are custom additions on top of stock shadcn — they exist specifically so status/semantic color doesn't fall back to raw palette colors. Always reach for these first.

App-specific calendar tokens (only meaningfully differ from stock shadcn tokens where noted): `--color-appointment-by`, `--color-tournament-de`, `--color-holiday`, defined per-theme in the `.dark`/`.light` blocks, sourced from Catppuccin's exposed `--catppuccin-color-<name>-<shade>` variables (e.g. `var(--catppuccin-color-lavender-400)`).

### Radius scale

Base `--radius: 0.625rem`. Derived scale: `--radius-sm` (base − 4px), `--radius-md` (base − 2px), `--radius-lg` (= base), `--radius-xl` (base + 4px). Convention in practice:
- `rounded-md` — buttons, inputs, small controls
- `rounded-lg` — panels, tables, dialogs, list containers
- `rounded-xl` — cards, prominent panels (dashboard tiles, mobile calendar container)
- `rounded-full` — pills (badges), avatars, status dots

## 2. Base components (`src/components/ui`)

Extend/compose these — don't hand-roll a new primitive if one exists here.

**Button** (`button.tsx`) — cva variants:
- `variant`: `default` (bg-primary), `destructive` (bg-destructive, white text), `outline` (border + bg-background + shadow-xs), `secondary` (bg-secondary), `ghost` (transparent, hover bg-accent), `link` (text-primary, underline on hover)
- `size`: `default` (h-9), `xs` (h-6), `sm` (h-8), `lg` (h-10), `icon` (size-9), `icon-xs` (size-6), `icon-sm` (size-8), `icon-lg` (size-10)
- Defaults: `variant="default" size="default"`.

**Badge** (`badge.tsx`) — pill shape (`rounded-full px-2 py-0.5 text-xs`), no size variants. `variant`: `default`, `secondary`, `destructive`, `success`, `warning`, `info`, `outline`, `ghost`, `link`. `success`/`warning`/`info` are this codebase's additions over stock shadcn — use them for status badges (publish state, response status, transaction type) rather than `outline` + manual color classes.

**Alert** (`alert.tsx`) — `rounded-lg border px-4 py-3`. `variant`: `default`, `destructive`, `success`, `warning`, `info` (no `outline`/`secondary` — all variants share `bg-card`, only text color changes).

**Card** (`card.tsx`) — plain classes, not cva: `Card` = `flex flex-col gap-6 rounded-xl bg-card py-6 text-card-foreground shadow-sm` (no border by default). Sub-parts: `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent` (`px-6`), `CardFooter`.

**Dialog vs Sheet** — both wrap the same Radix Dialog primitive; pick based on intent, not habit:
- `Dialog` (`dialog.tsx`) — centered modal, `rounded-lg border p-6 shadow-lg`, zoom+fade animation, `sm:max-w-lg`. Use for confirmations (delete) and short standalone forms.
- `Sheet` (`sheet.tsx`) — side-anchored drawer (`side` prop, default `right`), slide animation, `w-3/4 sm:max-w-sm`. Use for inline edit-in-place forms and mobile bottom-anchored panels (`side="bottom"`).

**`cn()`** (`@/lib/utils`) — merges Tailwind classes (clsx + tailwind-merge); use for every conditional class.

**`createColorForUserId(userId)`** (`@/lib/utils`) — deterministic hash into a 14-color Catppuccin palette, returns `{ backgroundColor, foregroundColor }` (`var(--catppuccin-color-<name>-100/900)`). Reuse this for avatar/user-tag coloring instead of inventing new per-user color logic.

## 3. Layout shell & breakpoint convention

App shell (`NavigationWrapper`, shadcn Sidebar/SidebarInset): a mobile-only top row (`flex h-11 w-full items-center gap-2 px-3 lg:hidden`, holding just the sidebar trigger inline with the page title — no border, no search button) disappears entirely at `lg:` — desktop has no app-shell chrome above the content, so each route's own page header (see "Desktop page header" below) carries the title. Page content wraps in `lg:mx-4 mx-0 p-4 relative`. Routes render directly into this — don't add another `container`/`max-w-*` wrapper around a page's root.

**Single breakpoint rule**: page-level mobile/desktop layout switches use exactly `lg:` (1024px), as two parallel sibling trees:

```tsx
<div className="lg:hidden">{/* mobile layout */}</div>
<div className="hidden lg:flex ...">{/* desktop layout */}</div>
```

Don't scatter `md:`/`sm:` into this split — pick `lg:` for the structural mobile/desktop fork. `sm:`/`md:` are fine for minor in-component adjustments (e.g. `Sheet`'s own `w-3/4 sm:max-w-sm`), just not for the page-level layout fork.

`useIsMobile()` (`src/hooks/use-mobile.ts`, 768px via `matchMedia`) is reserved for JS-level behavior CSS can't express — e.g. journal.tsx uses it only to decide whether a `Sheet`'s `open` prop should be true (`open={!!selected && isMobile}`), while the mobile-cards-vs-desktop-table split itself still happens via `lg:hidden`/`hidden lg:grid` classes. Don't use the hook to conditionally render entire layout branches that CSS could handle.

`usePrefersReducedMotion()` (`src/hooks/use-reduced-motion.ts`) — check before enter animations (`animate-in fade-in slide-in-from-top-1`) and drag-based transitions; skip/zero them out when true.

## 4. Page composition patterns

**Desktop page header**: `<h1 className="font-bold text-lg">{title}</h1>` + muted subtitle/count (`text-muted-foreground text-sm`, e.g. `"{matched} of {total} events"`) + right-aligned action `Button`s, all in one `flex items-center gap-3` row.

**Detail page header** (players, teams): breadcrumb-style instead — `<span className="text-muted-foreground text-sm">{t("Players")} /</span>` + `<span className="flex-1 font-semibold text-[15px]">{name}</span>`, followed by outline Edit + destructive-tinted Delete (`border-destructive/40 text-destructive hover:bg-destructive/10`).

**Lists**: desktop = shared `DetailsList` table component in `rounded-lg bg-card`; mobile = stacked custom row/card components, `flex flex-col gap-2.5`. Master-detail split: `grid grid-cols-[1fr_360px] gap-4`, detail rail `lg:sticky lg:top-6`. Row selection state: `cn("h-11 cursor-pointer", item.id === selectedId && "bg-muted")`.

**Empty states** (pick based on prominence):
- Primary: `rounded-lg bg-card p-8 text-center text-muted-foreground`
- Lighter/inline: `py-8 text-center text-muted-foreground`
- Unselected-state placeholder: `rounded-lg border border-border/60 border-dashed p-4 text-center text-muted-foreground text-sm` (e.g. "Select a row to see details")

**Loading**: no skeleton components in these pages. Use `Loader2Icon` with `animate-spin` inside buttons, and `isNavigating && "pointer-events-none opacity-60"` to dim a pane during router navigation (`useRouterState({ select: (s) => s.isLoading })`).

**Load-more pagination** — hand-rolled client-side batch accumulation (`BATCH_SIZE = 25`), not a library. Repeated verbatim in `appts/index.tsx` and `journal.tsx`:

```tsx
<div className="flex justify-center border-border/60 border-t pt-3">
  <Button variant="outline" className="w-full" disabled={isNavigating} onClick={onLoadMore}>
    {isNavigating && <Loader2Icon className="animate-spin" />}
    {isNavigating
      ? t("Loading…")
      : t("Load {0} more ({1} remaining)", Math.min(BATCH_SIZE, remaining).toString(), remaining.toString())}
  </Button>
</div>
```

**Mobile bottom-of-screen UI** — three distinct patterns, not interchangeable:

1. **Persistent action dock** (e.g. Accept/Maybe/Decline on appt detail, list/calendar tab switcher): `fixed inset-x-0 bottom-0 z-40 border-border/60 border-t bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-sm`, with matching `pb-*` reserved on the scrollable content so it never sits under the dock.
2. **True bottom `Sheet`** with drag-to-dismiss (journal.tsx): `SheetContent side="bottom"`, `showCloseButton={false}`, `className="max-h-[85vh] overflow-y-auto rounded-t-2xl border-t-0 duration-300 lg:hidden"`, a drag handle (`h-1.5 w-9 rounded-full bg-muted-foreground/30`), pointer-driven `translateY`, closes past a 96px threshold; transition disabled while dragging or when `prefersReducedMotion`. Visibility gated by `useIsMobile()` even though desktop reuses the same selection state for a sticky rail.
3. **`.fab` utility class** (`src/styles.css`, detail pages only) — fixed floating action button cluster: `<div className="fab"><Button asChild size="icon-lg"><div><CogIcon/></div></Button><Button size="icon-lg" onClick={onEdit}><EditIcon/></Button>...</div>`. First `[tabindex]` child is the toggle trigger; siblings reveal via `:focus-within` (rotate/fade the trigger, scale+fade in the rest).

**Edit forms**: use an edit-as-`Sheet` (right side, `SheetHeader`/`SheetFooter`, `fieldset` + `Label`/`Input` inside, `SheetClose asChild` Cancel + `type="submit" form="edit-appointment"` Save) for inline edits on a detail page. Use the `Modal` wrapper (`src/components/modal/Modal.tsx`, built on `Dialog`) for delete confirmations and standalone multi-field forms (`PlayerForm`, `TeamForm`). `Modal` always renders a `DialogTitle` (visually `sr-only` if no `title` given) and a `DialogFooter` with an optional custom action plus a default `DialogClose` "Close" button.

**Collapsible sections** (shadcn `Collapsible`) are a mobile-only space-saving device — desktop shows the same content unconditionally, never collapsed:

```tsx
<Collapsible className="rounded-lg bg-card">
  <CollapsibleTrigger className="group flex w-full items-center justify-between p-4 text-left">
    <span className="font-bold text-sm">{t("More details")}</span>
    <ChevronDownIcon className="size-4 text-muted-foreground transition-transform duration-200 ease-out group-data-[state=open]:rotate-180" />
  </CollapsibleTrigger>
  <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
```

## 5. Spacing conventions

Most-repeated values — prefer these over inventing new ones:
- Vertical stacks: `flex flex-col gap-3` (mobile), `gap-4`/`lg:gap-6` (desktop)
- Card padding: `p-4` (compact), `p-5`/`p-6` (prominent panels)
- Grid gaps: `gap-2` (dense stat tiles), `gap-4`/`gap-6` (section/column grids), `gap-2.5` (card lists)
- Label/value pairing: label `text-muted-foreground text-xs uppercase` above value `text-sm` (used throughout detail pages and dashboard tiles)
- Subtle dividers: `border-border/60` or `border-border/40`, not full-opacity `border-border`

## 6. Status/semantic color usage

- Publish state: `<Badge variant={isPublished ? "success" : "warning"}>`
- Appointment type: `<Badge variant="outline">{typeLabel(...)}</Badge>`
- Transaction actions: derive `{variant, label}` from `transactionActionBadge(item.type)` and feed straight into `<Badge variant={badge.variant}>`
- Small status dot: `<span className="size-1.5 shrink-0 rounded-full bg-success|bg-warning|bg-muted-foreground" />`

**Accept/Maybe/Decline tri-state buttons** — not badges, ghost `Button`s with tri-state color coding. This exact pattern is copy-pasted across `appts/index.tsx`, `appts/$apptId.tsx`, and `index.tsx` — reuse it verbatim for any similar RSVP-style control:

```tsx
<Button
  variant="ghost"
  className={cn(
    "flex-1 border border-success/30 text-success hover:bg-success/15 hover:text-success",
    isSelected && "border-success bg-success text-success-foreground hover:bg-success/90 hover:text-success-foreground",
  )}
  ...
/>
```
(swap `success` for `destructive` on the Decline button, and use a muted/neutral variant for Maybe)

**Calendar event categories** — reuse the shared `categoryStyle` map (`src/components/calendar/MonthCalendar.tsx`) rather than inventing new category colors:

```ts
export const categoryStyle: Record<AppointmentType, {gradient, solidText, dot}> = {
  HOLIDAY:       { dot: "bg-primary",  gradient: "bg-gradient-to-br from-primary to-primary/70",  solidText: "text-primary-foreground" },
  TOURNAMENT:    { dot: "bg-success",  gradient: "bg-gradient-to-br from-success to-success/70",  solidText: "text-success-foreground" },
  TOURNAMENT_DE: { dot: "bg-info",     gradient: "bg-gradient-to-br from-info to-info/70",         solidText: "text-info-foreground" },
};
```

## 7. Forms

Use `@tanstack/react-form` + `useMutation` (`src/hooks/useMutation.ts`) — not ad hoc `useState` + fetch.

Field structure (`src/components/settings/Profile.tsx` is the clean reference):

```tsx
<form.Field name="name">
  {(field) => (
    <fieldset className="flex flex-col gap-1.5">
      <Label htmlFor={field.name}>{t("Name")}:</Label>
      <Input
        id={field.name}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
      />
    </fieldset>
  )}
</form.Field>
```

- Labels are colon-suffixed: `{t("Name")}:`.
- Checkboxes: `<div className="flex items-center gap-2">` + `<Checkbox checked={...} onCheckedChange={(c) => field.handleChange(c === true)} />` + adjacent `<Label>`.
- Form-level error: `<div className="text-destructive text-xs">{formErrorMap.onChange}</div>`, sourced from `useStore(form.store, (state) => state.errorMap)`.
- Submit handler is always:
  ```tsx
  <form onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); form.handleSubmit(); }}>
  ```
- Submit button gates on both submittability and "form unchanged", and swaps to literal `"..."` text (not a spinner) while submitting:
  ```tsx
  <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting, state.isDefaultValue]}>
    {([canSubmit, isSubmitting, isDefaultValue]) => (
      <Button type="submit" className="mt-4 w-36" disabled={!canSubmit || isDefaultValue}>
        {isSubmitting ? "..." : t("Update")}
      </Button>
    )}
  </form.Subscribe>
  ```
- `onSuccess` boilerplate (repeats in every settings/mutation component):
  ```tsx
  onSuccess: async (ctx) => {
    const data = await ctx.data.json();
    if (ctx.data?.status < 400) {
      await router.invalidate();
      toast.success(data.message);
      return;
    }
    toast.error(data.message);
  },
  ```

`src/components/settings/CalendarFeed.tsx` is a known inconsistency (raw `<div>` section headings and `<div className="block text-sm font-medium mb-2">` instead of `fieldset`/`Label`, plus manual array-toggle checkboxes) — treat it as legacy-in-progress, not a pattern to copy.

## 8. Toasts

`sonner` via `src/components/ui/sonner.tsx` (themed to app tokens, per-variant lucide icons). Message text comes from the server response's `message` field (see `onSuccess` boilerplate above), not hardcoded in the component — except for pure client-side actions like clipboard copy, which use a local `t()` string directly: `toast.success(t("Feed URL copied to clipboard"))`.

## 9. What NOT to do

- Don't use daisyUI classes/components (`btn`, `alert`, native `<dialog>`, `modal-box`, etc.) — always check whether the file you're touching has actually been migrated before assuming a pattern in it is current.
- Don't introduce a new icon library, animation library, or color system outside the Catppuccin tokens above.
- Don't hardcode raw Tailwind palette colors (`text-red-500`, `bg-green-600`) for semantic meaning — use `success`/`warning`/`destructive`/`info` tokens.
- Don't mix `md:`/`sm:` into a page-level mobile/desktop layout fork — that's `lg:`'s job.
- Don't build custom fetch/mutation plumbing when the `useMutation` + toast pattern (section 7) applies.
- Don't add a `max-w-*`/`container` wrapper around a route's root — the app shell already constrains width via `lg:mx-4 mx-0 p-4`.
