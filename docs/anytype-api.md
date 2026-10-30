# Anytype local API facts the adapters rely on

v1 facts, checked against a real account on API version `2025-11-08`:
- A date property's value is `{ key, format: 'date', date: '2026-09-13T22:00:00Z' }`:
  RFC 3339, always UTC, no zone of its own. A property the object has no value for is left
  out of `properties` altogether.
- Nothing marks a date as date-only. One set without a time is stored as the first instant
  of that day where it was set (22:00 UTC for a day in UTC+2), so `toEventsDatedObject`
  reads a date on the first instant of a local day as all-day.
- Search filter conditions are the short names — `eq`, `ne`, `gt`, `gte`, `lt`, `lte`,
  `empty`, `nempty` … — not the long ones the OpenAPI enum lists, which answer 400. A
  date condition takes `date` as RFC 3339 or `YYYY-MM-DD`, and compares by whole local
  days: `gte` rounds to the start of its day, `lte` to the end. So date filters only
  narrow a search; the exact overlap is checked in the domain. `lte` also matches an empty
  date, hence `nempty` beside it. `{ operator, conditions, filters }` nests `and`/`or`
  groups.
- A filter on a property key the space does not have answers 400 (`failed to build
  expression filters`); an unknown type key or space id answers an empty page.
- Paging is `?offset=&limit=` (at most 1000) with `pagination.has_more`.

v2 (pre-release: it may change without a new version; spec at
`https://developers.anytype.io/openapi-v2.yaml`), checked against a real account in September
2026. The same process and port serve both majors, so a v2 build still serves v1, and a legacy
key works with both; a key paired through v2 (scoped) does not work with v1. The client's
types spell these out, and its `README.md` repeats the ones its users need; a new fact about
the wire belongs there too:
- Spaces are served by a six-character short reference unless `?ids=full` is asked for; the
  client always asks, since the saved selection stores full ids. Both spellings are accepted
  back. The list holds only the key's granted spaces, never the tech space, and says nothing
  of a space's kind, so one-to-one chats cannot be left out. Its top-level
  `has_not_granted_spaces` says the grant leaves some of the account's spaces out; the schema
  sync carries it as `hasNotGrantedSpaces`, and onboarding and Settings show a hint for it.
- `GET /v2/auth/whoami?ids=full&spaces=true` describes the key: `grant { scoped, restricted,
  all_spaces, permission, spaces[{ id, name, permission }] }` and `key_status`. A legacy key
  (issued before grants) answers `scoped: false`, `permission: null`, `key_status: "legacy"`;
  a restricted one lists its spaces; an all-spaces grant lists every live space too, which is
  not its boundary. Pairing answers `grant { all_spaces, space_ids, permission: 'read' |
  'readwrite' }`, or null. `api.version` says `2025-11-08` even over v2, so it is never shown.
- A type list row is only `{ key, name }`; the icon and properties are in the type document
  (`GET …/types/{key}`: `icon`, `type_settings.property_definitions[{ property, internal_key,
  name, format }]`). That document spells `lastOpenedDate` in camelCase, where every other
  route says `last_opened_date`. Done is the bundled `done` (checkbox) and Location the
  bundled `location` (text); a user property of the same name is not them.
- A select's options are `GET …/properties/{key}/options` → `{ name, color }`, space-wide and
  with no id: a search row names the picked option by its name, as a list (`["P4"]`). v1 has
  no such route, so `colourBy` is offered only under v2. `color` is one of the same ten names
  type icons use, drawn with the same hues (`hueOf`, `lib/schema.ts`).
- A query (Anytype's "set": its type key is `query`) is found by searching `{ type: 'query' }`,
  which, like every search, leaves archived objects out. Its row names no type: the document
  (`GET …/objects/{id}?include=properties`) has `query_source: { types: ['task'] }`. Its views
  are `GET …/queries/{id}/views` → `{ id, name, type?, filters? }`, `id` a compact suffix of the
  24-hex view id, accepted back like the full one; Anytype refuses to delete a query's last
  view. `GET …/queries/{id}/objects?view=&fields=a,b` pages rows shaped like a search's, through
  the view's own filters and no others, so it cannot be narrowed by date. Without `view` the
  first applies, with a `warnings` entry (`path: 'view'`) naming it; an unresolvable
  placeholder in a view's filters is a warning too, not an error. `fields` is checked against
  the space's properties, not the type's; an unknown view answers 404. v1 has no query routes,
  so queries are offered only under v2, and a v1 read matches a chosen one with nothing.
- The type document's `property_definitions` carry a `section` (`featured`, `hidden` or none):
  a hidden one (last modified by …) is never offered to the detail panel, nor are `name` and
  `type`, which it draws anyway. The panel draws `text`, `number`, `select`, `multi_select`,
  `url`, `email`, `phone` and `objects`; v1 reads none of them, and Settings hides the panel,
  Done and Location fields under v1. A multi-select's options come from the same route as a
  select's.
- A row's value for a property with none is left out, or comes as `null`, `""` or `[]`. A
  deleted select option is served by its object id, not a name. `objects` is a list of ids:
  their names come from one search per space (`{ property: 'id', condition: 'in', value }`,
  at most 1000 ids each), which never finds a space member (`participant-<identity>`); members
  are matched on `identity` in `GET …/members`, read only when one is linked. Links open
  through main's `shell.openLink`, which takes only `http(s)`, `mailto:` and `tel:`.
- A space row may carry `icon_image`, a file id: `GET …/files/{id}/content?width=64` answers
  the image's bytes (PNG seen). `files.content` reads it through the same injected
  `fetch`; the v2 schema gateway turns it into a `data:` URL (Base64 injected by the
  composition root), cached by file id since a changed image gets a new id. The renderer's
  CSP allows `img-src data:` for it.
- **Keys differ from v1's where a user's type or property collides with one Anytype bundles**
  (a user "Book" type, a "Status" property): v1 serves the slug (`book`), v2 the internal key
  (`6a67272659c08021576f3127`), and v2 refuses the slug as `ambiguous_input`. Both majors
  accept the internal key as input, but each serves its own spelling in rows. The type
  document keeps v1's type key as `type_settings.api_key`; a property's v1 key is known only
  to v1, matched by name. `rekeySchemaSelection` rewrites a v1-saved selection after each
  sync (`formerKey` on types and date properties).
- Search takes `{ type, filters, fields }`. Structured `filters` use the long condition names
  (`greater_or_equal`, `not_empty` …) and dates as **unix seconds**, and still round date
  comparisons out to whole local days; `less_or_equal` still matches an empty date. The
  compact `filter` string cannot spell a key that starts with a digit, as internal keys may,
  so the adapters do not use it. Rows are `{ id, name, type, properties: { [key]: value } }`
  with only the `fields` asked for: a date is a bare RFC 3339 string, and one the object has
  no value for is left out — so is an unticked Done, read as not done.
- An object can carry a property its type does not list, typically one a template shows in
  its content as a block (`{ type: 'property', property: 'due_date' }`; blocks are a flat list).
  A search with `type` refuses such a key in `fields` and filters (400 `unknown property key`),
  so the events read never sends `type`: it filters on it instead (`{ property: 'type',
  condition: 'equal', value: 'page' }`, the type's key, not its object id), which checks keys
  against the space and returns the same objects. The schema sync finds those properties by
  reading each space's templates (`GET …/templates`, rows `{ id, name, template_for }`, then
  each document with `?include=blocks`) and, only when one adds a key, the space's properties
  (`GET …/properties` → `{ key, name, format }`). A build serving neither reads as no templates.
  A property set by hand on single objects, in no template, is not found.
- An unknown type key or a `fields`/filter key the space lacks answers 400, a space not open
  404, a space outside the key's grant 403 `space_not_granted`: all read as "no objects". A
  403 on a space's types, or on one type, reads as no types: the grant changed since the list.
- Paging puts `has_more`, `total` and a `message` hint at the top level. v2's own errors are
  `{ status, code, message, issues[] }`; pairing, key and rate-limit refusals keep v1's shape.
  `AnytypeApiError` carries the issues, and a refused write is shown in its first one's words.
- Writes (v1 has none): `PATCH …/objects/{id}` with `{ ops: [{ op: 'set_properties', set:
  { [key]: value } }] }`, atomic; `POST …/objects` with the shortcut `{ type, name, properties }`
  answers `201 { id, etag }`. A date is written as RFC 3339, like it is read, and cleared as
  `null` (not yet checked against a real Anytype). Every write carries
  an `Idempotency-Key` (a replay of the same key and body returns the stored response), and one
  that got no answer is sent once more with it. No `If-Match`: search rows have no etag, so the
  last write wins. A read-only key answers 403 `write_not_granted`, a busy one 429.
- Collections (October 2026): Anytype's bundled Collection type is `collection`, found by
  searching `{ type: 'collection', fields: ['last_modified_date', 'backlinks'] }`; rows carry
  `backlinks` as object ids, which the schema sync reads names for (`GET …/objects/{id}
  ?include=properties`, once per id) only where a name repeats in the space. v2 cannot create
  into one: `CreateEventsObject` creates, then sends `PATCH …/objects/{collectionId}` with
  `{ ops: [{ op: 'add_items', items: [id] }] }` (1 to 1000 ids; one already in it is ignored),
  each with its own `Idempotency-Key`. An add that fails leaves the object created, and the
  outcome says so (`{ ok: true, collection }`), which the calendar shows as a toast. The
  client types only `set_properties`; other ops pass through it as given.
