---
name: commit-conventions
description: This repo's git commit conventions — conventional-commit type/scope format, which scope names to use, when to split a change into multiple commits, body style, and the AI attribution footer. Load before writing any git commit or commit message in this repository.
---

Derived from this repo's own commit history (43 commits, one author, no
wip/fixup/revert commits — every commit lands clean). Follow this instead of asking again.

## Message format

```
type(scope): imperative, lowercase, no trailing period
```

- **Imperative, present tense**: "add", "split", "share", "drop" — not "added"/"adds". A
  handful of early commits used past tense ("updated revoke text"); treat those as the
  exception, not the pattern.
- **Lowercase** immediately after `type(scope):`. **No trailing period.**
- Subject alone is normal; observed length ranges roughly 20–82 characters. No hard wrap is
  enforced, but keep it to one line and let a body carry any further explanation.

### Types actually used here

| type       | for |
|------------|-----|
| `feat`     | new capability or behavior |
| `fix`      | bug fix |
| `refactor` | internal restructuring, no behavior change |
| `chore`    | tooling, scaffolding, editor/agent config — nothing under `packages/*/domain\|application\|infrastructure` or the renderer |
| `docs`     | documentation-only |
| `build`    | build tooling / dependency setup |

Don't reach for `test:`, `perf:`, `style:` etc. — they don't appear in this repo's history;
only add a new type if a change genuinely doesn't fit the six above.

### Scope

The scope is the package or app directory name: `auth`, `schema`, `kernel`,
`anytype-client`, `desktop` (for `apps/desktop`). **Omit the scope entirely** for a change
that isn't owned by one package — repo-wide restructuring, root docs, root config
(`refactor: restructure packages by bounded context`, `docs: add project README`).

## Body

Most commits in this repo are **subject-only** — no body. Add one only when the *why* isn't
obvious from the subject and the diff, e.g.:

```
refactor(schema): split SchemaSyncService into SyncSchema and ResetSchemaSync

Each method was a distinct use case pulling in dependencies the other
didn't need; ResetSchemaSync now depends on the store alone instead of
also carrying the gateway and API key source it never touched.
```

One short paragraph (2–4 lines), blank line before it, states the reason for the change —
never a restatement of the diff. This mirrors the no-comments rule in AGENTS.md: say what
the code/diff can't say for itself.

## Splitting into multiple commits

**This is the part most worth getting right.** This repo's history never lands a
multi-package change as one commit — even a single feature is built as a sequence of small
commits, each scoped to one package or one clear step, each independently buildable. Look at
how auth's sign-in flow was built:

```
feat(auth): add auth session model and ports
feat(auth): add AuthService use case and session store
feat(auth): add in-memory auth adapters
feat(desktop): wire the auth context into main and expose it over IPC
feat(desktop): derive the auth screens from the session in main
...
feat(anytype-client): add the shared Anytype HTTP client package
feat(auth): add the Anytype auth gateway
feat(auth): add an encrypted-file credential repository
feat(desktop): persist the key with safeStorage and sign in against Anytype
```

When a task touches two independent things (e.g. refactoring both the `auth` and `schema`
application layers, or a new shared package plus the two contexts that consume it), split
by scope rather than committing everything at once — each commit should get its own `type(scope)`
and stand on its own: typecheck, `npm test`, and `npm run lint:arch` all pass at that commit,
not just at the tip.

### When the split isn't clean-cut on disk

Some files are legitimately touched by two logically separate changes at once —
`apps/desktop/src/main/composition.ts` is the recurring example, since it wires every
context together in one file. Don't commit it whole with either change. Either:

- `git add -p` to stage only the relevant hunks per commit, or
- when the hunks are too interleaved for that, reconstruct the intermediate file content by
  hand (write the version with only the first change applied, commit, then apply the second
  change back on top) — and **typecheck/test/lint at each intermediate state**, not just the
  final one, since that's the whole point of splitting.

## Attribution footer

Commits made with AI assistance in this repo carry a trailer:

```
Co-Authored-By: <model name as the current session's system instructions specify> <noreply@anthropic.com>
```

Use whatever attribution the *active* session's system instructions give — don't hardcode a
model name from an earlier commit (this repo's history alone spans two: `Claude Opus 5` and
`Claude Sonnet 5`). A commit made without AI assistance carries no such trailer; don't add
one to a commit you didn't help write.
