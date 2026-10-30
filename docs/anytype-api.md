# Anytype local API facts the adapters rely on

v2 (pre-release: it may change without a new version; spec at
`https://developers.anytype.io/openapi-v2.yaml`), checked against a real account in September
2026. A legacy key, paired through v1 before grants, works with it. The client's types spell
these out, and its `README.md` repeats the ones its users need; a new fact about the wire
belongs there too:
- Nothing marks a date as date-only. One set without a time is stored as the first instant
  of that day where it was set (22:00 UTC for a day in UTC+2), so `toEventsDatedObject`
  reads a date on the first instant of a local day as all-day.
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
  with no id: a search row names the picked option by its name, as a list (`["P4"]`). `color`
  is one of the same ten names
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
  the space's properties, not the type's; an unknown view answers 404.
- The type document's `property_definitions` carry a `section` (`featured`, `hidden` or none):
  a hidden one (last modified by …) is never offered to the detail panel, nor are `name` and
  `type`, which it draws anyway. The panel draws `text`, `number`, `select`, `multi_select`,
  `url`, `email`, `phone` and `objects`. A multi-select's options come from the same route as
  a select's.
- A row's value for a property with none is left out, or comes as `null`, `""` or `[]`. A
  deleted select option is served by its object id, not a name. `objects` is a list of ids:
  their names come from one search per space (`{ property: 'id', condition: 'in', value }`,
  at most 1000 ids each), which never finds a space member (`participant-<identity>`); members
  are matched on `identity` in `GET …/members`, read only when one is linked. Links open
  through main's `shell.openLink`, which takes only `http(s)`, `mailto:` and `tel:`.
- A space row may carry `icon_image`, a file id: `GET …/files/{id}/content?width=64` answers
  the image's bytes (PNG seen). `files.content` reads it through the same injected
  `fetch`; the schema gateway turns it into a `data:` URL (Base64 injected by the
  composition root), cached by file id since a changed image gets a new id. The renderer's
  CSP allows `img-src data:` for it.
- **A user's type or property that collides with one Anytype bundles** (a user "Book" type, a
  "Status" property) is served by its internal key (`6a67272659c08021576f3127`), and its slug
  (`book`) is refused as `ambiguous_input`. v1 served the slug, so a selection saved while the
  app read through v1 may name a type by it: the type document keeps that key as
  `type_settings.api_key`, and `rekeySchemaSelection` rewrites such a choice after each sync
  (`formerKey` on types). A property's v1 key was known only to v1, so properties are not
  rekeyed: one that no longer resolves falls back as any stale property does.
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
- Paging is `?offset=&limit=` (at most 1000), with `has_more`, `total` and a `message` hint at
  the top level. v2's own errors are `{ status, code, message, issues[] }`; pairing, key and
  rate-limit refusals keep v1's shape.
  `AnytypeApiError` carries the issues, and a refused write is shown in its first one's words.
- Writes: `PATCH …/objects/{id}` with `{ ops: [{ op: 'set_properties', set:
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
