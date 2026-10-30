# AI artifact layout and architecture

How AI artifacts are organised, where each tool looks for them, and how this
staging repo maps them to the company repo (`snl-Engineering/.github`).

> Status: **design draft**. Items marked ⚠️ are unverified and need checking
> against the company repo before the promote flow depends on them.

## 1. Artifact types

| Artifact | Purpose | Loaded | Format |
|---|---|---|---|
| `copilot-instructions.md` | Repo-wide rules ("how we build here") | Always, automatically | Plain Markdown |
| `AGENTS.md` | Tool-neutral agent instructions (Copilot cloud agent and CLI, plus other agent tools) | Always; the nearest `AGENTS.md` to the edited file wins | Plain Markdown |
| `*.instructions.md` | Scoped rules, e.g. "for `**/*.ts` do X" | Automatically when the file matches `applyTo` | Frontmatter (`applyTo`, optional `excludeAgent`) + Markdown |
| `*.prompt.md` | Reusable task templates the user invokes (slash command) | On demand | Frontmatter (`description`, `agent`, `model`, `tools`) + Markdown |
| `*.agent.md` | Custom agent: a named specialist with its own instructions and tool set | Selected by the user, or delegated to as a subagent | Frontmatter (`description`, `tools`, `model`, MCP servers) + Markdown |
| `skills/<name>/SKILL.md` | Packaged capability: instructions plus scripts and resources, loaded when relevant | On demand, chosen from the `description` | Frontmatter (`name`, `description`) + Markdown + files |
| `hooks/*.json` | Deterministic scripts run at lifecycle events (e.g. `preToolUse`) | Automatically at the event | JSON (`version`, `hooks`) |

Rule of thumb for choosing a type:

- Always true for the repo → **instructions**.
- True only for some files → **scoped instruction**.
- A task the user starts → **prompt**.
- A role with its own tools or persona → **agent**.
- Knowledge or tooling needed only sometimes → **skill**.
- Must happen every time, with no model discretion → **hook**.

## 2. Hierarchy: scopes and precedence

```
Enterprise  ─┐   shared agents (and policy)
Organization ┤   shared agents    ← company repo: snl-Engineering/.github
Repository   ┤   instructions, scoped instructions, prompts, agents, skills, hooks
Personal     ┘   ~/.copilot (CLI): personal agents, skills, instructions
```

- Broader scopes provide shared defaults. Narrower scopes add to or override them
  (a repo agent with the same name as an org agent takes precedence).
- Instructions are **additive**: repo-wide, matching scoped, and nearest
  `AGENTS.md` are all combined. Keep them non-contradictory.
- Agents, prompts and skills are **selected**, not merged.

## 3. Layout inside a consuming repository

```
AGENTS.md                              nearest-wins; may also appear in subfolders
.github/
  copilot-instructions.md
  instructions/<name>.instructions.md
  prompts/<name>.prompt.md
  agents/<name>.agent.md
  skills/<name>/SKILL.md               + scripts/, references/, assets/
  hooks/<name>.json
```

This is what the app lists and edits today (`TYPES` and `SINGLETONS` in
`index.html`), and it is the layout of this staging repo.

## 4. Layout in the company repo (organisation scope)

Organisation-level custom agents live in the **`/agents` folder at the root** of
the organisation's `.github` (or `.github-private`) repository, not under
`.github/agents/`. They are available to every org member, whether or not they
can read the repo.

```
snl-Engineering/.github
  agents/<name>.agent.md             org-wide custom agents
  profile/README.md                  org profile (unrelated to AI artifacts)
  ...community health files          CONTRIBUTING, SECURITY, templates, etc.
```

Consequence: **the company repo is not a mirror of a consuming repo.** Promotion
needs a path mapping, not a plain copy.

### Proposed promotion mapping

| Staging path | Company repo path | Notes |
|---|---|---|
| `.github/agents/<n>.agent.md` | `agents/<n>.agent.md` | Org-wide agent |
| `.github/instructions/<n>.instructions.md` | `instructions/<n>.instructions.md` | Not an org-scope feature as far as known. Treated as a **template library** that teams copy into their own repos |
| `.github/prompts/<n>.prompt.md` | `prompts/<n>.prompt.md` | Template library, as above |
| `.github/skills/<n>/SKILL.md` (+ folder) | `skills/<n>/SKILL.md` | Template library, as above |
| `.github/hooks/<n>.json` | `hooks/<n>.json` | Template library, as above |
| `.github/copilot-instructions.md` | `templates/copilot-instructions.md` | Template library |
| `AGENTS.md` | `templates/AGENTS.md` | Template library |

**Decision:** all artifact types are promoted. Only **agents** are known to
take effect from the company repo directly; the other types are a curated
library that product repos copy from. ⚠️ Whether the other folders take effect
is unverified. If the company repo already uses a different structure, that structure wins and
this table changes.

## 5. Naming and quality rules

- File names are lower-case kebab-case; the name is the identifier
  (`code-reviewer.agent.md`). It must match `NAME_RE` in the app.
- A skill folder name must equal the `name:` in its `SKILL.md`.
- Every agent, prompt and skill has a precise `description`; it is how the
  tool decides to use the artifact.
- No placeholder text, secrets or tokens (enforced by `scripts/validate.js`).
- Hooks never contain credentials; reference environment variables.

## 6. Promotion flow (target design)

1. Draft and edit in this staging repo, on a branch.
2. `scripts/validate.js` and the `artifact-tester` agent check it.
3. **Promote** computes the destination with the mapping in section 4
   (the optional path prefix field remains for extra nesting), copies the artifact
   (a whole folder for skills), and opens a PR in the company repo.
4. A human reviews and merges in the company repo.
5. Repos and teams consume it: agents automatically, other types by copy.

## 7. Open questions

1. What structure does `snl-Engineering/.github` use today? (It was not visible
   to the build agent's token.)
2. ~~Which types to promote?~~ Decided: all of them.
3. Is a separate `.github-private` repo preferable for agents that should not
   be publicly readable? Both locations work the same way for org agents.
4. Should promotion be a PR to the company repo (current design) or a
   cross-repo copy with an approval label?

## References

- GitHub Docs: Preparing to use custom agents in your organization
  (agents live in `/agents` of the org `.github` or `.github-private` repo).
- GitHub Docs: Custom agents (repository, organisation and enterprise
  scopes; personal profiles in Copilot CLI).
