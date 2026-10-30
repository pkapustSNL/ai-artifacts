# AI Artifacts

Create, read and update Copilot artifacts (agents, instructions, prompts, skills, hooks,
`copilot-instructions.md`, `AGENTS.md`) in your GitHub repos.

## Web / iPhone app

A static installable PWA served from the repo root by GitHub Pages: https://pkapustsnl.github.io/ai-artifacts/

- Sign in with a fine-grained personal access token (**Contents: Read and write**). It is kept in
  this browser's localStorage and only sent to api.github.com.
- On iPhone: open the URL in Safari > Share > Add to Home Screen.
- To commit to a different branch (e.g. a protected `main`), fill in "Commit to branch"; it is created if missing.
- Instructions can be nested: name them `parent/child` (or use **＋ Sub-instruction** on an open instruction) to create `.github/instructions/parent/child.instructions.md`; children are listed indented under their parent. Renaming a parent does not move its children.
- Use **Rename** / **Delete** in the editor. Each is a single commit (skills move or delete their whole folder; renaming a skill also updates its `name:`). Both honour "Commit to branch".
- **Promote** opens a PR in a target repo (default `snl-Engineering/.github`) containing the artifact (a skill promotes its whole folder). Your token needs Contents and Pull requests write access to that repo. Paths follow `docs/artifact-layout.md` (agents → `agents/`, other types → `instructions/`, `prompts/`, `skills/`, `hooks/`, singletons → `templates/`); an optional prefix adds nesting.

## Local server (`server.js`)

Dependency-free Node app for local files (workspace `.github/` and `~/.copilot`):

```
WORKSPACE=/path/to/repo node server.js   # http://localhost:4173
```

Env vars: `WORKSPACE` (default: cwd), `USER_DIR` (default: `~/.copilot`), `PORT` (default: 4173).

## Validating artifacts before promotion

```
node scripts/validate.js   # checks .github/ artifacts and AGENTS.md
node --test test/          # tests for the validator
```

Checks: file path/suffix, frontmatter (`description`; `name` matching the folder for skills), valid hook JSON,
leftover template/TODO text, and likely secrets. The same checks run on every pull request
(`.github/workflows/validate.yml`). Freshly created artifacts fail until the template text is replaced.
