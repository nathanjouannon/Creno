## What

<!-- The change, in a few lines. -->

## Why

Closes #<!-- ticket number -->. <!-- Rules RG-xx, stories F-xx concerned. -->

## How tested

<!-- Automated tests (names) and what you checked by hand. -->

## Docs

<!-- ADR, API contract, glossary updated, or "none". -->

## Definition of done (`docs/definition-of-done.md`)

Strike through a box that does not apply and say why; do not leave it empty.

**Code and tests**

- [ ] Every acceptance criterion of the ticket is checked, one by one
- [ ] Each Given/When/Then scenario and each RG-xx cited by the ticket has a test named with its identifier
- [ ] The required tests of the task exist (concurrency, access denied, data cleanup)
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` pass; coverage thresholds are met
- [ ] No hard-coded style value: only classes from the tokens (ADR-0010)
- [ ] Names come from `glossary.md`; business rules are in services, not in the interface or repositories
- [ ] Every external input is validated by a Zod schema; permissions are checked on the server (RG-14)

**Contract and documents**

- [ ] Route or error changed: Zod schema changed, `pnpm api:generate` run, `docs/api/openapi.yaml` and `docs/api/errors.*` committed, `pnpm api:check` green
- [ ] Architecture choice changed: ADR added or updated, and `architecture/architecture.md` in the same commit
- [ ] Database schema changed: migration with its rollback script, `domain/schema.sql`, `domain/erd.mmd` and `schema.prisma` aligned, apply-undo-replay test green
- [ ] Rule, term or story changed: `business-rules.md`, `glossary.md` or `user-stories.md` updated
- [ ] Environment variable added: `.env.example` and `architecture/environments.md`

**Visible quality**

- [ ] Interface: usable at 360 px without horizontal scroll, French text, loading, empty and error states handled
- [ ] Accessibility: axe reports no serious or critical violation, keyboard navigation works
- [ ] Logs: no password, token or full e-mail; error responses carry no technical detail
- [ ] No secret in the repository (secret scan green)

**Delivery**

- [ ] The description above cites the ticket (`Closes #n`) and lists what was tested by hand
- [ ] The whole CI chain is green
- [ ] Another person (or an AI review followed by human validation) reviewed this pull request
- [ ] Known gaps and out-of-scope ideas are open tickets, not forgotten `TODO` comments
