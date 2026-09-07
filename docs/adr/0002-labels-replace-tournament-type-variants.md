# Labels Replace Tournament Type Variants

`AppointmentType` used to carry two tournament variants, `TOURNAMENT` and `TOURNAMENT_DE`, to distinguish Bavaria-only from all-Germany tournaments. That type distinction also silently drove behavior: `TOURNAMENT_DE` appointments got no RSVP panel and no push notifications, and the calendar feed could only separate the two as fixed checkboxes.

We collapsed both back into a single `TOURNAMENT` type and introduced a generic, editor-managed **Label** entity (flat name + color, many-to-many with Appointment, unlimited per appointment, tournament-only) so editors can express arbitrary attributes — region, coach relevance, or anything added later — without a schema change per attribute. Labels are purely informational: every tournament now gets RSVP and notifications regardless of its labels. Any "I don't care about this" preference is expressed per-user as a label mute list (notification settings, calendar feed), not as suppressed core functionality baked into the appointment's type or its labels.

**Considered:** keeping some labels behaviorally special (e.g. a label that still suppresses RSVP for its appointment). Rejected — it would have recreated the same type-shaped coupling this change exists to remove, just moved from an enum into label data.

**Consequences:** existing `TOURNAMENT_DE` rows migrate to plain `TOURNAMENT` with no labels attached; an editor must re-tag them by hand. `Appointment.shortTitle` is dropped in the same migration (unrelated cleanup bundled with this schema change) — `title` is now the only display string.
