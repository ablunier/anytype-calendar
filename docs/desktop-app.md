# apps/desktop structure

Standard electron-vite three-process layout:
- `src/main` — Electron main process and the **composition root**. Adapters are chosen
  only in the per-context modules (`auth/compose-auth.ts`, `schema/compose-schema.ts`,
  `events/compose-events.ts`, `feeds/compose-feeds.ts`), each switching once on what
  `anytype/compose-anytype.ts` returns: `{ kind: 'fake' }` under
  `ANYTYPE_CALENDAR_FAKE_AUTH=1`, or `{ kind: 'real', client }`. `composition.ts` calls them
  all, builds the `app-config.json` they share, and must run after `app` is ready
  (`safeStorage` needs that). It returns `{ auth, schema, events, feeds, preferences, updates }`,
  each group's type inferred from its compose function, and each `register*Ipc` takes only its
  own group (`registerEventsIpc` also the session and schema sync it refreshes on focus). Auth uses `AnytypeAuthGateway` against `http://127.0.0.1:31009` — it pairs
  through v2 (the user then picks the spaces and read/write access in Anytype) — and keeps
  the key in `<userData>/credential.bin`, encrypted with `safeStorage`
  (`EncryptedFileCredentialRepository`). Without OS encryption it falls back to the
  in-memory repository; on Linux's `basic_text` backend it persists anyway, with a
  warning. Every context's Anytype gateway shares one `AnytypeClient`. Schema and events
  each read the key through their own port (`SchemaApiKeySource`, `EventsApiKeySource`),
  which `compose-auth.ts` adapts from auth's credential repository as `apiKeys`; events reads which
  types go on the calendar through `EventsSourceSelection`, adapted from schema's selection
  store (`events/event-sources.ts`: only the chosen types and queries of chosen spaces, types
  first; Done, Location, the colour-by property and the panel's only where the last schema
  sync saw the type — for a query, the type it runs over — with them, since Anytype refuses a search
  `field` the space lacks; a saved From or To that sync saw the type without reads as the type's
  own dates, as the renderer draws it, since a filter on it would match nothing), and places a
  span in the machine's time zone (`LocalEventsTimeZone`). The contexts are linked in
  `context-links.ts`, which imports neither Electron nor Node core and is tested in the `main`
  project: entering `connected` syncs the schema and loads the span on screen, and leaving it
  resets both (a session that stays connected — `access-checked` replacing its access — reads
  nothing again); a successful schema sync and every saved selection reload that span, and a
  sync rekeys the selection; an `unauthorized` schema or span failure signs out while connected
  (`outdated` and `unreachable` keep the key); and a window gaining focus re-runs both, at most once per 30 s
  (`events/events-ipc.ts`), along with `CheckAuthAccess`. That use case asks Anytype what the
  connected key reaches (`verifyApiKey`, which always asks `whoami` afresh, so a grant changed
  in Anytype shows): it fills in `access` for a key restored at launch, where it starts `null`,
  and refreshes it on focus; an outdated or unreachable Anytype leaves it as it is. The
  connected session's `access` is `{ grant }`; a null `grant` is a legacy key, paired before
  grants existed, which reaches every space with write access. `LoadEventsSpan` lets the
  newest load win, so leaving a span or changing Settings mid-load never draws a stale
  result. Edits (`RescheduleEventsObject`, `CreateEventsObject`, `CompleteEventsObject`) write
  through `EventsWriter` — `AnytypeEventsWriter`, or in fake mode the same
  `InMemoryEventsGateway` that reads, so an edit shows on the next read — and then re-run
  `LoadEventsSpan`. Meanwhile the moved or ticked object is held in `EventsSpanStore` as an
  edit in flight: `get()` is the load the use cases dispatch to, `shown()` draws the edits over
  it and is what IPC pushes, so a drag never snaps back while Anytype is asked, and a refused
  write drops it. `events-ipc.ts` validates each request (`events/edit-requests.ts`) and
  answers `not-granted` without writing unless `authAccessCanWrite(session.access)`: a
  read/write grant, or no grant of its own. The renderer reads the same rule as an
  `EditAccess` (`editAccessFor`, `lib/session.ts`), which turns dragging off and has a
  double-click say why; every failed edit is a toast (`lib/edit-text.ts`). A move is
  worked out in the domain (`rescheduleEventsDatedObject`): an all-day date is written as the
  first instant of its day and a range keeps its day count, a timed one lands on the wall-clock
  minute asked for (`EventsTimeZone.at`, which a DST day would put an hour off as
  `startOfDay` plus minutes) and keeps its length. A `resize` moves the To alone, and gives one
  to an object that had none; `clear-end` clears it, which the writer sends as a null date. Both
  are refused for a source whose To is its From, or that has none (`eventsSourceHasEnd`). The
  panel's From and To (`EventDetail`) are a `TimeField`, typed in and read on blur or Enter
  (`parseTime`), and a `DateField`, which opens the sidebar's `MiniMonth` as a picker rather
  than `<input type="date">`, which draws in Chromium's locale and has no `gl`. Each writes as
  it is set, through the same reschedule as a drag. The panel keeps the object as last seen, so
  one an edit took out of the span still shows its new dates, with a "Go to date" link.
  Feeds need nothing of Anytype: they are loaded from their cached copies at launch and read
  again right after the window opens, every 30 minutes and on focus (at most once per 30 s,
  `feeds/feeds-ipc.ts`), whether or not the session is connected, and leaving `connected`
  resets nothing of theirs. They follow the span events holds (`showFeedsForSpan`, on every
  `EventsSpanStore` change, and before any load the span a launch opens on): `FeedsStore`
  expands each feed's last good read over that span's window in memory, so moving between spans
  reads no feed again, and a failed read keeps the last good copy drawn, with why on its
  status. `IcalFeedsCalendarParser` expands recurrences (`RRULE`, `EXDATE`, `RECURRENCE-ID`
  overrides) with ical.js, reads a `TZID` by the feed's own `VTIMEZONE`, or by the IANA zone of
  that name through `Intl` where the feed leaves it undefined, and a date or a floating time on
  the machine's clock; a `DATE` end is exclusive. It remembers each rule's instances, so a
  second window only walks past the furthest one asked for. The subscriptions are kept in
  `<userData>/feeds.json`, in order, each URL sealed with `safeStorage` (a secret ICS address
  is a credential), and the last good copy of each in `<userData>/feeds-cache/<id>.json`, both
  owner-only; without OS encryption both stay in memory, like the key. A `FeedsSnapshot` names
  a subscription only by host, never its URL, so Settings edits an address with an empty field
  that sends one only to replace it; a new address, like an added one, is read before it is
  saved, and a refresh still reading the old one drops what it reads. The renderer merges the feeds' events into the
  span's (`lib/feeds.ts`, keyed by `feedSourceKey`), and they are never dragged, created or
  ticked; their panel opens a `URL` through `shell.openLink`, and the parser keeps only an
  `http(s)` one. The sidebar's plus beside Calendars opens Settings at the form that adds one.
  Before any load it opens on `defaultEventsSpan` (`events/default-span.ts`), built
  from the saved view and week start — which is why `main/index.ts` awaits those two
  preferences before restoring the session, the thing that starts that first load. `ANYTYPE_CALENDAR_FAKE_AUTH=1` swaps in `InMemoryAuthGateway` (accepted code
  `2749`, logged to the terminal, or the API key `ak_fake_2749` pasted directly), a
  separate `credential-fake.bin`,
  `InMemorySchemaGateway` (the design's four sample spaces) and `InMemoryEventsGateway`
  (the design's sample month, seeded around the current month; it ignores the window and
  returns every object of a source, as the port allows), and `InMemoryFeedsGateway`, which
  answers any `.ics` address with a sample feed (a weekly meeting with one week moved and one
  skipped, an all-day holiday and a call in New York's time), kept in `feeds-fake.json`. The schema selection is plain
  JSON in `<userData>/schema-selection.json` (`schema-selection-fake.json` in fake mode,
  since the fake space ids are not real ones), loaded alongside the key before the first
  window opens. A missing or unreadable file means onboarding was never done. The local API cannot revoke
  keys, so there is no revoke action: users delete keys in Anytype's settings.
  `src/main/<context>/` holds that context's Electron-side glue: e.g. `auth/auth-ipc.ts`,
  `schema/schema-ipc.ts` and `events/events-ipc.ts` register the IPC handlers and push
  every state change to all windows, and `auth/credential-storage.ts` and `schema/selection-storage.ts` adapt
  `safeStorage` and the filesystem (`atomic-file.ts`) to the repositories' injected ports.
- `src/shared/ipc.ts` — the IPC contract used by all three processes: channel names, the
  `SessionSnapshot`, `SchemaSnapshot`, `SchemaSelectionSnapshot` and `EventsSnapshot` the
  renderer receives (none carries the API key), and `CalendarApi`. The span on screen is
  main's: `events.showSpan` asks for one (validated with `toEventsSpan`), and the
  `EventsSnapshot` pushed back says which span it holds. An `EventsSpan` is a discriminated
  union — `{ kind: 'month', year, month }`, or `{ kind: 'week' | 'day', start }` — so each
  kind carries only what pins it down and no two of its fields can disagree; its window
  (`eventsSpanWindow`) reads a month with a week of slack either side, enough to cover the
  grid's padding rows whichever day the week starts on.
- `src/preload` — exposes `CalendarApi` to the renderer as `window.api` (plus
  `@electron-toolkit/preload`'s default API as `window.electron`). `index.d.ts` types
  `window.api` for the renderer too — `tsconfig.web.json` includes it.
- `src/renderer/src` — the React app:
  - `App.tsx` is the renderer root: screen switching and theme. **Screens derive from the session**: until it is
    connected, the auth card shown is `authViewFor(session)` (`lib/session.ts`) of the
    snapshot main pushes (`hooks/useSession.ts`, over the generic `usePushedState`), and
    auth buttons only send intents over `window.api`. Once connected, navigation between success / onboarding / config / calendar
    is local `useState`, not a router — four fixed screens, no URLs. Entering `connected`
    lands on the success card when the window drew the sign-in; a window whose first
    snapshot is already connected (key restored at launch, or a reload) goes straight to
    the calendar. Never key this off the phase just before `connected`: pushes can be rendered
    together, so a transient phase like `verifying` may never be drawn. One rule overrides
    the local screen: until a selection is saved (`unset`), every screen past the success
    card is onboarding, so a restored key that never finished it still gets it. Continue
    saves the picks; Skip saves an empty selection on first run and saves nothing later.
    Settings (`screens/config`) saves each change as it is made, and `SaveSchemaSelection`
    runs those saves one at a time, in order. Both screens start their picks only once the
    account has been read: over no types, every saved date would fall back to a default.
    The calendar's arrows, Today and view switcher only ask main for a span, and
    `CalendarScreen` is keyed by the span main pushes back, so another span starts with no day
    selected and no panel open. Switching view saves the preference *and* asks for the new
    span in one handler: the preference is only what the next launch opens on, while
    `span.kind` is what this window draws. The new span is built around `switchDateFor` —
    today when the span on screen covers it, so switching from this month lands on this week,
    and otherwise the day the span is anchored on, so a reader of another month stays there.
    The calendar's sidebar (`screens/calendar/CalendarSidebar`) holds a mini month and the sources the
    calendar holds: the chosen spaces, each with its chosen types and then queries (`SourceTree`),
    then the subscribed calendars in their saved order (`FeedList`), every one with a toggle. Hiding is renderer-only: a hidden source is still read, and
    `visibleEvents` (`lib/visibility.ts`) drops its events before anything draws, so a toggle needs no
    request. An object two sources bring arrives as two events (`CalendarEvent.rank`, the source's
    position in the selection, types first) and only the lowest-ranked visible one is drawn, so a type
    hidden leaves an object a visible query brings drawn as the query places it. Hidden types are not
    offered by `CreateEventDialog`, and an open panel for a hidden object closes. The hidden keys
    (`objectTypeKey` / `querySourceKey` / `feedSourceKey`, never spaces) and whether the sidebar is collapsed are saved in
    the `calendarVisibility` section (`main/preferences/calendar-visibility.ts`), as are the spaces folded in the tree
    (`collapsedSpaces`; folding only hides the rows, never the sources); keys no longer in the selection are
    dropped on the next save. `useCalendarVisibility` works each change out from the latest value saved,
    not the last one pushed, so two toggles in a row both count. The mini month follows the span on
    screen (the screen is keyed by it, so it starts over on it), steps through months on its own, and a
    clicked day asks main for `spanFor(span.kind, date)`; it marks no days that hold objects.
    The theme toggle lives in the
    calendar's top bar only; other screens follow the system theme until it is used.
    Each of these preferences is one `preference({ section, initial, parse })`
    (`main/preferences/preference.ts`): a store, a load and a save over its section of
    `app-config.json`, served by `registerPreferenceIpc`. A parser returns `undefined` for what is
    not a value, so `null` can be one; a load falls back to the initial value.
    The week-numbers preference (Settings → Calendar, off by default; ISO weeks) is saved like the
    theme, in the `weekNumbers` section of `app-config.json` (`main/preferences/week-numbers.ts`). The month grid
    draws it in a gutter beside each week row, never as a column of it: bars are positioned as
    `100% / 7` of that row. The first day of the week (Settings → Calendar, Monday by default) is
    saved the same way, in the `weekStart` section (`main/preferences/week-start.ts`), as an index with
    Monday 0 and Sunday 6; the grid, its headers and its weekend shading follow it, and a row's
    week number is that of its Thursday.
    The time format (Settings → Calendar, 24-hour by default) is saved likewise, in the `timeFormat`
    section (`main/preferences/time-format.ts`) as `'24h'` or `'12h'`. Times stay `HH:MM` in the view model;
    `formatTime` (`lib/calendar.ts`) draws them, reading the format from `TimeFormatContext`.
    The view a launch opens on (Settings → Calendar, the month by default) is saved the same
    way, in the `calendarView` section (`main/preferences/calendar-view.ts`) as `'month' | 'week' | 'day'` —
    the same three names an `EventsSpan`'s `kind` uses, so there is one vocabulary for them.
    The app is localized into English, Spanish and Galician (`react-i18next`, resources under
    `renderer/src/i18n/locales/`). The language (Settings → Calendar) follows the OS language
    by default: `LanguageSnapshot` (`main/preferences/language.ts`, saved in the `language` section of
    `app-config.json`) is `'en' | 'es' | 'gl' | null`, where `null` — the initial value, and
    "System default" in the Select — means "follow the OS", the same shape `ThemeSnapshot`
    uses for the OS theme. Unlike the theme, which reads `prefers-color-scheme` in CSS,
    resolving `null` to an actual locale needs a JS-visible value, so it happens in the
    renderer: `resolveLocale` (`lib/locale.ts`) matches `navigator.languages` against the three
    shipped locales, and `useLocale` (mirroring `useTheme`'s "follow the OS until overridden"
    shape) feeds the result to `i18next.changeLanguage`. Components read translations with
    `react-i18next`'s own `useTranslation`, not a bespoke context. The pure `lib/` modules
    (`calendar.ts`, `schema.ts`, `events.ts`) have no hook access, so they stay
    translation-free: `lib/calendar.ts`'s date/weekday/time formatting takes a `locale`
    argument and calls `Intl.DateTimeFormat` directly instead of a hardcoded English table.
    Electron bundles Chromium's own ICU data, not Node's, and unlike `es`, Chromium's copy
    carries no `gl` data at all (`Intl.DateTimeFormat.supportedLocalesOf` comes back empty for
    it) — every `Intl` call for Galician would otherwise silently draw in Chromium's default
    locale instead. `lib/calendar.ts` detects this (`supportsLocale`) and falls back to a
    small hardcoded Galician vocabulary table, checked against Node's own `Intl` output for
    `gl` (which, confusingly, *does* carry it) so the wording matches what real `Intl` would
    produce; `calendar-gl-fallback.test.ts` forces the fallback path by mocking
    `supportedLocalesOf`, since a plain test run — under Node — never takes it otherwise. And
    `lib/schema.ts`/`lib/events.ts`'s sync-status text (`elapsedSince`, `syncViewFor`,
    `spanStatusFor`) returns a `SyncDetail`/`Elapsed` shape that a component resolves to text
    with `syncDetailText` (`lib/sync-text.ts`). `Wordmark`'s brand text and the literal Anytype
    menu breadcrumb in `SessionSection`'s revoke instructions are deliberately left
    untranslated — a product name and another app's own UI labels, not this app's copy.
  - `lib/session.ts` is the only renderer module that reads a `SessionSnapshot`'s shape;
    components receive the UI-local `AuthView` instead. `lib/schema.ts` does the same for a
    `SchemaSnapshot` (`hooks/useSchemaSync.ts`) and a `SchemaSelectionSnapshot`
    (`hooks/useSchemaSelection.ts`): it turns them into `Space[]`, `ObjectType[]`, a
    `SyncView` and `TypePicks`, and turns picks back into the `SchemaSelection` to save.
    `lib/events.ts` does the same for an `EventsSnapshot` (`hooks/useEvents.ts`): the span
    on screen, its status, and its objects as `CalendarEvent`s in local `YYYY-MM-DD` dates
    and `HH:MM` times, keyed to their `ObjectType` with `lib/schema.ts`'s `objectTypeKey`, or
    `querySourceKey` for one read through a query: a query is an `ObjectType` too, with
    `query` set (its views) and its type's hue and dates, so the pickers, the picks and the
    chips treat both alike. `typesInSpace` and `queriesInSpace` (`lib/calendar.ts`) split them.
    A result kept from another span is never drawn on this one. It also owns the span algebra
    the renderer needs: `spanFor` (the span a view wants around a date), `anchorOf` (the date
    a span is anchored on — the first of a month, the first day of a week, the day itself),
    `shiftSpan` (one step in the span's own units) and `switchDateFor`.
  - `types/index.ts` holds UI-local view-model types (e.g. `AuthView`, `CalendarEvent`,
    `ObjectType`, `Space`), deliberately kept out of the packages' domain layers — they
    describe what a component needs to draw, not what the calendar means.
  - `screens/<flow>/` — one directory per screen (`auth`, `onboarding`, `config`, `calendar`),
    each with its own subcomponents. `screens/calendar` holds all three views: `CalendarScreen`
    keeps the chrome and switches on `span.kind` between `MonthGrid` and `TimeGrid`, and
    `TimeGrid` serves the week and the day alike — they differ only in how many columns it
    draws, so it takes `days: DayColumn[]`, seven of them or one.
  - `components/ui/` — presentational primitives (Button, Card, Dialog, Select, Tag, etc.),
    barrel-exported from `components/ui/index.ts`. `Combobox` is a Select that can be typed in
    to narrow it; the caller does the matching (`optionsFor`), so it knows nothing of what it
    lists. `CreateEventDialog` uses it for the Collection field, over `collectionChoices` and
    `collectionPicksFor` (`lib/schema.ts`): None first, names matched ignoring case and accents,
    and same-name collections told apart by the backlinks they do not all share, or else by
    when they were last modified.
  - `components/app/` — app-level chrome shared across screens (`Wordmark`,
    `SpaceMonogram`, `TypeTile`). Only types carry a hue: their Anytype icon colour, one
    category hue per each of Anytype's ten (`lib/schema.ts`). Anytype gives spaces no
    colour, so a space is marked by its initial in neutral ink.
  - `lib/calendar.ts` — calendar grid/date math for every view, over local `YYYY-MM-DD`
    dates, which compare in order as strings: `buildMonthGrid`, `buildWeek`, `addDays`, and
    the `monthLabel`/`weekLabel`/`dayLabel` formatters. `weekLabel` uses
    `Intl.DateTimeFormat`'s `formatRange`, which says only what changes between the two dates
    — the month once inside one, twice across two, the year twice only across New Year — in
    the locale's own order.
  - `lib/month-layout.ts` — where a week's objects are drawn: one segment per object per
    week (`layOutWeek`), so a range is one continuous bar from its first day to its last,
    cut only at a week's edges — a month is read with a week of slack either side, so the days
    a row borrows from the adjacent months carry their objects too, dimmed but drawn, and a
    cut side is squared off and runs flush. The week view's all-day band reuses it with a
    higher lane cap: the same problem, one row of it. Segments
    are packed into lanes so a bar keeps one vertical slot all week; past `MAX_LANES` an
    object is dropped and counted in the `+N more` of each day it covers. The bar is drawn
    by the cell its segment starts in, keeping the grid's rows and cells intact, but is
    positioned against the week row, whose columns it has to span (`event-span` in
    `styles/index.css`, which reads `--columns` and `--lane-top` from the row it sits in, so
    the same utility serves a seven-column month row and a one-column day band).
  - `lib/time-grid.ts` — where the week and day views put a day's timed objects.
    `splitDayEvents` first sends everything an hour grid cannot place to the all-day band:
    all-day objects, and ranges crossing midnight, which belong to several days at once and
    read better as one bar across them. `layOutDayColumn` then places the rest by the minute
    and packs overlapping ones into columns — a run of transitively overlapping objects is
    sized together, so a bar keeps one width throughout, though an object clear of an earlier
    one reuses the column it freed. An object with no To date is a moment, drawn at
    `MIN_SLOT_MINUTES`, not something running on to midnight.
  - Import convention: anything outside the importing file's own directory is reached
    through the `@renderer/*` alias (`@renderer/lib/calendar`), never `../..`;
    same-directory imports stay relative (`./EventChip`). The IPC contract is reached as
    `@shared/ipc` from every process. Each alias is declared in several places that must
    agree — `resolve.alias` in `electron.vite.config.ts` (used by `dev`/`build`), `paths`
    in `tsconfig.web.json` (and `tsconfig.node.json` for `@shared`; used by `typecheck`),
    and `paths` in the root `tsconfig.paths.json` (used by `lint:arch`; a missing entry
    there shows up as `not-to-unresolvable` errors, not as a build failure).
