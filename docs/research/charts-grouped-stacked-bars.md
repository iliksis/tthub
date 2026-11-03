# Research: grouped and stacked bars in @tanstack/charts

Ticket: iliksis/tthub#71

## Question

Can `@tanstack/charts` draw a bar chart with age group on the x axis, bars grouped by gender (male / female / unknown), and each bar stacked eligible + not eligible (eligible solid, not eligible muted)?

## Answer

**Yes, but not with a built-in "grouped + stacked" layout.** One `barY` mark can do grouped-stacked if you precompute the stack intervals yourself and pass them as explicit `y1`/`y2` endpoints, with `layout: group()`. The tooltip needs a custom formatter, because `group-x` focus collapses the two segments of a bar into one row.

Verified empirically: I compiled the sketch below with `createChartScene` against the published package and got 6 rects per age group, laid out in three side-by-side sub-bands, with each segment stacked at its own `y1`/`y2` interval.

## Version

- `package.json`: `"@tanstack/charts": "^1.2.1"`
- `package-lock.json`: resolved `1.2.1`
- Sources read: the published `@tanstack/charts@1.2.1` tarball (`docs/`, `dist/*.js`, `dist/*.d.ts`, `llms.txt`). The package was not installed in this worktree, so I fetched it with `npm pack`. The sources are identical to what `npm ci` installs.

## How the layouts work (primary sources)

1. **`layout` takes one value, either `group()` or `stack()`.**
   - `dist/bar.d.ts`: `type BarLayout = GroupLayout | StackLayout`.
   - `dist/bar.js` (`barY`, ~lines 45-66): an implicit stack is computed only when `!explicitExtent && !grouped`. When `grouped`, `y2` is the raw value and `y1` is 0.
2. **Explicit `y1`/`y2` plus `group()` is allowed.**
   - `dist/bar.js` throws only for explicit endpoints combined with `layout.type === "stack"`: "A bar with explicit y1 or y2 endpoints cannot also configure a stack layout".
   - `docs/concepts/marks-and-layering.md`: "Explicit `y1`/`y2` ... channels opt out of implicit stacking and preserve authored intervals."
   - `docs/examples/stacked-and-composition.md`: "supply interval endpoints when the application has already computed them."
3. **`z` controls placement, `color` stays independent.**
   - `docs/reference/marks/bar-and-rect.md`, "Grouped bars": "When both are present, `z` controls placement and interaction grouping while `color` remains independent."
   - So `z: "gender"` places the sub-band and `color: "series"` (gender + eligibility) picks the fill.
   - `dist/bar.js`: `groupValues = grouped ? seriesValues : ...`, where `seriesValues` is `z` when `z` is set.
4. **The group scale is a band scale inside the x band.**
   - `resolveGroupScale` in `dist/bar.js`: `group({ padding })` or `group({ scale })` for a fixed subgroup order.
   - It throws if a row's group is null or outside the group scale domain.
5. **`fillOpacity` is a plain `number`, not a channel.**
   - `dist/bar.d.ts`: `fillOpacity?: number`.
   - `fill` is a `VisualChannel` (constant or per-datum accessor) and overrides the color scale for the paint.
   - So "muted" has to come from different colors, not per-bar opacity. See "Muted styling" below.
6. **`focus: "group-x"` returns one point per distinct `group` value at the hovered x.**
   - `dist/focus.js`, `groupPoints`: keeps one point per `valueKey(point.group)`.
   - `docs/reference/focus-and-interaction.md`: "One point per group sharing the semantic x value".
   - The bar point's `group` is the `z` value (`dist/bar.js`: `group: groupValues[i]`). Both segments of "male, U12" share `group = "male"`, so the tooltip gets 3 points per age group (one per gender), not 6.
   - For each gender, the point is whichever segment is under the pointer, else the first in data order (the eligible one).
7. **The bar's interaction `yValue` is the segment's `y2`, which is the cumulative total.**
   - Scene dump: the not-eligible point has `yValue: 7`, `y1Value: 5`, `y2Value: 7`, where the real count is 2.
   - The default tooltip would therefore show cumulative numbers for the muted segment.
   - Use the tooltip `format`/`formatGroup`/`content` callbacks with `point.datum` fields instead (`docs/guides/tooltips-and-focus.md`: precedence is `content`, `formatGroup`, `format`, then automatic).

## Minimal sketch (matches `RosterBreakdownChart` in `src/routes/_authed/stats.tsx`)

Not applied to `src/`. Assumes rows shaped like `{ ageGroup, gender, eligible, notEligible }` (one row per age group and gender).

```tsx
const GENDERS = [
	{ color: "var(--color-chart-male)", key: "male", label: () => m.stats_player_count_male() },
	{ color: "var(--color-chart-female)", key: "female", label: () => m.stats_player_count_female() },
	{ color: "var(--color-chart-undefined)", key: "unknown", label: () => m.stats_roster_unknown() },
] as const;

function EligibilityByAgeChart({ rows }: { rows: EligibilityRow[] }) {
	const definition = useMemo(() => {
		// Two segments per (ageGroup, gender), stacked by hand: eligible [0, e],
		// not eligible [e, e + n]. `group()` cannot be combined with implicit stack.
		const points = rows.flatMap((row) =>
			GENDERS.flatMap((g) => {
				const eligible = row[g.key].eligible;
				const notEligible = row[g.key].notEligible;
				const base = { ageGroup: row.ageGroup, eligible, gender: g.label(), notEligible };
				const id = `${row.ageGroup}|${g.label()}`;
				return [
					{ ...base, hi: eligible, id: `${id}|e`, lo: 0, series: `${g.label()}|e` },
					{ ...base, hi: eligible + notEligible, id: `${id}|n`, lo: eligible, series: `${g.label()}|n` },
				];
			}),
		);
		const series = GENDERS.flatMap((g) => [`${g.label()}|e`, `${g.label()}|n`]);
		const range = GENDERS.flatMap((g) => [
			g.color,
			`color-mix(in srgb, ${g.color} 40%, transparent)`,
		]);

		return defineChart({
			color: {
				// legend: colorLegend() would list all 6 entries; see caveats.
				scale: () => scaleOrdinal<string, string>().domain(series).range(range),
			},
			focus: "group-x",
			marks: [
				barY(points, {
					color: "series", // fill per (gender, eligibility)
					key: "id", // must be unique across age groups, see caveats
					layout: group({ padding: 0.1 }),
					x: "ageGroup",
					y1: "lo",
					y2: "hi",
					z: "gender", // sub-band placement + focus grouping
				}),
			],
			maxFocusDistance: Number.POSITIVE_INFINITY,
			scales: {
				x: { scale: () => scaleBand<string>().padding(0.3) },
				y: { grid: true, nice: true, scale: scaleLinear },
			},
			tooltip: tooltip({
				// One row per gender (group-x dedupes by z), with both counts from the datum.
				formatGroup: (points) =>
					points
						.map((p) => `${p.datum.gender}: ${p.datum.eligible} / ${p.datum.notEligible}`)
						.join("\n"),
			}),
		});
	}, [rows]);
	// <Chart definition={definition} ... /> as in RosterBreakdownChart
}
```

The `tooltip(...)` call with options and the exact `formatGroup` return type (string vs. rows) were taken from `docs/guides/tooltips-and-focus.md` ("Customize plaintext content with typed formatters"). They were not run. Check the `ChartTooltipContentContext` types when implementing. The bar compile path (`createChartScene`) was run; the tooltip was not exercised.

### Muted styling

- **Six-entry color scale** (above): simple. The legend shows 6 swatches, which may be noisy.
- **Three-entry scale plus `fill` accessor**: set `color: "gender"` for a 3-entry legend, and `fill: (d) => d.status === "eligible" ? solid : muted` for the paint. `fill` bypasses the color scale (`docs/concepts/data-and-channels.md`), so the legend would show only the solid color. The app would need to explain "muted = not eligible" elsewhere (caption or custom legend).
- **Per-bar opacity is not available**: `fillOpacity` is a number for the whole mark. Splitting into two `barY` marks (one per eligibility), each with its own `fillOpacity`, also works, since both can use the same `z` group scale. That doubles the mark definitions.
- `color-mix(in srgb, ...)` in a fill needs a browser-supported CSS color. The existing tokens are CSS variables, which already render in SVG fills here.

## Caveats

- **No native grouped-stacked layout in 1.2.1.** Stack endpoints are computed by the app. If the data layer changes, the intervals must be recomputed.
- **Tooltip gives one point per gender, not per segment.** Reason: `group-x` dedupes by `group`. The workaround is a custom formatter (or `content`) reading `eligible`/`notEligible` from `point.datum`. Do not rely on the automatic tooltip: it shows `y2`, which is the cumulative height for the muted segment.
- **Keys must include the age group (verified).** The scene key for a bar is `${markId}:${valueKey(group)}:${valueKey(key)}`. The x value is not part of it. In my run, `key: "series"` gave 12 rects but only 6 unique keys, because the same (gender, segment) repeats in every age group. Use a per-row `id` such as `${ageGroup}|${gender}|e` (as in the sketch) so keys are unique.
- **Zero-height segments.** Rows with 0 produce zero-height rects (e.g. 0 not eligible). They are harmless but still count as focus points.
- **Radius.** `radius: { end, stack: "outer" }` is rejected with `group()` and explicit extents (`docs/reference/marks/bar-and-rect.md`). Use a plain radius or none.
- **Y domain.** `includeZero` is `y1 === undefined` in `dist/bar.js`. With explicit `y1`, zero is not forced into the domain. The bars start at 0 here, so the domain still includes 0, but `y: { nice: true }` alone will not guarantee it if every `lo` is greater than 0. That cannot happen with this data because eligible segments start at 0.
- **Accessibility and keyboard navigation.** `group-x` gives one representative per semantic x value (`docs/reference/focus-and-interaction.md`), so keyboard users step per age group, not per bar.

## Alternatives if the hand-stacked approach is rejected

| Option | How | Trade-offs |
| --- | --- | --- |
| **A. Hand-stacked grouped bars (recommended)** | Single `barY`, `layout: group()`, explicit `y1`/`y2`, `z: gender`, `color: series` | Matches the requested chart exactly. Needs precomputed intervals and a custom tooltip. |
| **B. Two charts** | One `barY` stack (`color: eligibility`, default implicit stack) per gender, or one chart per eligibility status, laid out side by side | Uses only built-in behavior, default tooltip works. Loses the shared x axis and the single comparison across genders. Needs a shared y domain (`scales.y.scale` with a fixed domain) to be comparable. More chrome. |
| **C. One chart, six bars per age group** | `barY`, `layout: group()`, `z: series` (gender + eligibility), no stack | Fully built in, with default tooltip and legend. Eligible and not eligible are side-by-side, so the per-gender total is no longer visible as one bar. Six thin bars per group are cramped on mobile. |
| **D. Facets** | `docs/guides/faceting-and-composition.md` (`text-frame-and-facet` mark reference) | Could facet by gender with stacked eligibility inside. Not evaluated in detail, and it needs the facet API read first. |

## Sources

- `@tanstack/charts@1.2.1` tarball: `dist/bar.js`, `dist/bar.d.ts`, `dist/group.d.ts`, `dist/stack.d.ts`, `dist/focus.js`.
- Same package: `docs/reference/marks/bar-and-rect.md`, `docs/concepts/marks-and-layering.md`, `docs/concepts/data-and-channels.md`, `docs/examples/stacked-and-composition.md`, `docs/reference/focus-and-interaction.md`, `docs/guides/tooltips-and-focus.md`, `docs/reference/runtime-and-scene.md`.
- Repo: `src/routes/_authed/stats.tsx` (`PlayerCountChart`, `RosterBreakdownChart`).
- Empirical check: `createChartScene` from `@tanstack/charts/scene`, run in a scratch directory outside the repo (not committed).
