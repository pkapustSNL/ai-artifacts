# AI Artifacts

Create, read and update Copilot artifacts (agents, instructions, prompts, skills, hooks,
`copilot-instructions.md`, `AGENTS.md`) in your GitHub repos.

## Web / iPhone app

A static installable PWA served from the repo root by GitHub Pages: https://pkapustsnl.github.io/ai-artifacts/

- Sign in with a fine-grained personal access token (**Contents: Read and write**). It is kept in
  this browser's localStorage and only sent to api.github.com.
- On iPhone: open the URL in Safari > Share > Add to Home Screen.
- To commit to a different branch (e.g. a protected `main`), fill in "Commit to branch"; it is created if missing.

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
