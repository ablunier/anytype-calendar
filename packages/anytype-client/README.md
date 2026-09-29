# @ablunier/anytype-client

A typed TypeScript client for the [Anytype](https://anytype.io) desktop app's
[local API](https://developers.anytype.io), version 2.

- One method per route: no paths, query strings or version headers to get right.
- Zero runtime dependencies. It needs only a `fetch`, the platform's own by default, so it
  runs in Node 18+, Electron, Deno, Bun and browsers alike.
- Error statuses come back as values, not exceptions, so each caller decides what a 403 or a
  404 means to it.
- Writes carry an `Idempotency-Key` and are retried once when they get no answer.

> A community project, not affiliated with or endorsed by Any Association. API v2 is a
> pre-release: Anytype may change it without a new version, and this client follows. Until
> it settles, releases are `0.x`.

## Install

```sh
npm install @ablunier/anytype-client
```

ESM only. The Anytype desktop app must be running: the API listens on
`http://127.0.0.1:31009`.

## Pairing

An app gets a key by asking Anytype for a challenge. Anytype then shows the user a 4-digit
code, and the user chooses which spaces the key reaches and whether it may write.

```ts
import { AnytypeClient } from '@ablunier/anytype-client'

const anytype = new AnytypeClient()

const challenge = await anytype.auth.createChallenge({ appName: 'My app' })
if (!challenge.ok) throw new Error(challenge.error.message)

const code = await askTheUser() // the 4 digits Anytype shows
const paired = await anytype.auth.createApiKey({ challengeId: challenge.body.challenge_id, code })
if (!paired.ok) throw new Error(paired.error.message)

const { api_key, grant } = paired.body // grant: { all_spaces, space_ids, permission } or null
```

## Reading and writing

Every other route needs a key. `withApiKey` is cheap, so an app whose key can change makes a
new one per call:

```ts
const api = anytype.withApiKey(apiKey)

const whoami = await api.auth.whoami({ spaces: true })
const spaces = await api.spaces.list()
const task = await api.types.get(spaceId, 'task')

const found = await api.search.inSpace(spaceId, {
  type: 'task',
  filters: [
    { property: 'due_date', condition: 'not_empty' },
    { property: 'due_date', condition: 'less_or_equal', value: Math.ceil(Date.now() / 1000) }
  ],
  fields: ['due_date', 'done']
})

await api.objects.update(spaceId, objectId, [{ op: 'set_properties', set: { done: true } }])
```

### Results

Nothing throws for an error status. A call resolves to one of these:

```ts
{ ok: true, status, body }                     // body typed as the route serves it
{ ok: false, status, error, unsupported }      // error: { code, message, issues[] }
```

A call rejects only with an `AnytypeTransportError`: Anytype could not be reached, or it sent
a success whose body is not JSON.

`unsupported` is true when the route does not exist in the running Anytype: a build without
v2 answers a bare plain-text 404. A 404 about something that does not exist (an unknown
space, type or object) always carries an error `code`, so the two never get mixed up. Pass
`onUnsupported` to hear about it from every call, e.g. to fall back to v1.

### Paging

List routes take `{ offset, limit }`. `listAll` reads every page:

```ts
import { listAll } from '@ablunier/anytype-client'

const all = await listAll((paging) => api.types.list(spaceId, paging))
if (all.ok) console.log(all.body.data, all.body.pages.flatMap((page) => page.warnings ?? []))
```

### Options

```ts
new AnytypeClient({
  fetch, // e.g. to add a timeout: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(10_000) })
  baseUrl, // defaults to http://127.0.0.1:31009
  randomId, // makes each Idempotency-Key; defaults to crypto.randomUUID
  onUnsupported // called when a route answers as if it did not exist
})
```

For a route this client has no method for yet, `anytype.request({ method, path, query, body,
apiKey, idempotent })` sends it through the same machinery.

## Coverage

Coverage is partial. It covers what its first consumer, a calendar app, needs, and it grows
on request.

| Area | Methods |
| --- | --- |
| Pairing | `auth.createChallenge`, `auth.createApiKey` |
| Key | `auth.whoami` |
| Spaces | `spaces.list` |
| Types | `types.list`, `types.get` |
| Properties | `properties.listOptions` |
| Search | `search.inSpace` |
| Queries | `queries.listViews`, `queries.listObjects` |
| Objects | `objects.get`, `objects.create`, `objects.update` |
| Files | `files.content` |

Not yet covered: global search, space members, collections, templates, chats, widgets,
schemas, validation, and creating or editing spaces, types and properties.

## What Anytype actually serves

Bodies are typed but not validated. These are the quirks that the types spell out, checked
against a real Anytype in September 2026:

- **Ids.** The client always asks for full ids (`ids=full`). The six-character default can
  become ambiguous when the account joins another space. Both spellings are accepted back.
- **Spaces.** The list holds only the key's granted spaces. `has_not_granted_spaces` says
  whether the grant leaves others out.
- **Keys of user types and properties.** A user type or property whose name collides with one
  Anytype bundles (a user "Book" type) is served by its internal key
  (`6a67272659c08021576f3127`), not by the slug v1 serves. v2 refuses the slug as
  `ambiguous_input`. A type document keeps v1's key as `type_settings.api_key`.
- **Type documents.** A type list row is only `{ key, name }`: the icon and properties are in
  the type document. That document spells a few of Anytype's own keys in camelCase
  (`lastOpenedDate`), where every other route says `last_opened_date`.
- **Rows.** Object rows carry only the `fields` asked for. A date is a bare RFC 3339 string in
  UTC. A select is the list of its picked options' names. A property with no value is left
  out, and so is an unticked checkbox.
- **Filters.**
  - Use the long condition names (`greater_or_equal`, `not_empty` …), with dates as unix
    seconds.
  - Date comparisons round out to whole local days, and `less_or_equal` also matches an empty
    date.
  - The compact `filter` string cannot spell a key that starts with a digit, as user property
    keys may.
- **Field and filter errors.** A `fields` or filter key the type lacks answers 400, and so
  does an unknown type key. A space outside the key's grant answers 403 `space_not_granted`.
- **Queries.** A query (a "set") is found by searching `{ type: 'query' }`. Its document names
  what it runs over in `query_source.types`. Its objects come through one view's own filters
  and no others. Without `view` the first view applies, with a warning at `path: 'view'`.
- **Writes.**
  - A date is written as RFC 3339.
  - A read-only key answers 403 `write_not_granted`, and a busy one 429.
  - Pairing, key and rate-limit refusals come back in v1's error shape; the client
    normalises both shapes into `error`.
- **Version.** `whoami`'s `api.version` says `2025-11-08` even over v2.

## License

MIT
