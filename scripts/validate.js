#!/usr/bin/env node
// Validates AI artifacts under .github/ (and AGENTS.md). No dependencies.
// Usage: node scripts/validate.js [rootDir]   -> exits 1 if any error is found.
const fs = require("fs");
const path = require("path");

const NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
const KINDS = [
  { dir: "agents", suffix: ".agent.md", required: ["description"] },
  { dir: "instructions", suffix: ".instructions.md", required: [] },
  { dir: "prompts", suffix: ".prompt.md", required: ["description"] },
  { dir: "hooks", suffix: ".json", json: true },
];
const SECRETS = [
  [/gh[pousr]_[A-Za-z0-9]{30,}/, "GitHub token"],
  [/github_pat_[A-Za-z0-9_]{30,}/, "GitHub fine-grained token"],
  [/AKIA[0-9A-Z]{16}/, "AWS access key"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
  [/\b(?:api[_-]?key|secret|password|token)\s*[:=]\s*['"]?[A-Za-z0-9_\-]{16,}/i, "hard-coded credential"],
];
const PLACEHOLDERS = [/\bTODO\b/, /\bFIXME\b/, /Describe what this/i, /Write your (instructions|prompt) here/i, /Skill instructions here/i, /Describe the agent's behavior/i, /Describe this prompt/i];

function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return null;
  const fields = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2].trim();
    else if (line.trim() && !line.trim().startsWith("#") && !/^\s/.test(line) && !line.startsWith("-"))
      fields.__invalid = line;
  }
  return { fields, body: text.slice(m[0].length) };
}

function checkContent(file, text, problems) {
  for (const [re, label] of SECRETS) if (re.test(text)) problems.push({ file, level: "error", msg: `possible ${label}` });
  for (const re of PLACEHOLDERS) if (re.test(text)) problems.push({ file, level: "error", msg: `placeholder text left: ${re}` });
}

function checkMarkdown(file, text, kind, expectedName, problems) {
  const fm = frontmatter(text);
  const err = (msg) => problems.push({ file, level: "error", msg });
  if (!fm) {
    if (kind.required.length) err("missing YAML frontmatter (--- block)");
    return;
  }
  if (fm.fields.__invalid) err(`invalid frontmatter line: "${fm.fields.__invalid}"`);
  for (const k of kind.required) if (!fm.fields[k]) err(`frontmatter "${k}" is required`);
  if (kind.name && fm.fields.name && fm.fields.name.replace(/^["']|["']$/g, "") !== expectedName)
    err(`frontmatter name "${fm.fields.name}" must match folder "${expectedName}"`);
  if (!fm.body.trim()) err("body is empty");
}

function validate(root) {
  const problems = [];
  const gh = path.join(root, ".github");
  const list = (d) => { try { return fs.readdirSync(d, { withFileTypes: true }); } catch { return []; } };
  const rel = (f) => path.relative(root, f);
  const read = (f) => fs.readFileSync(f, "utf8");
  let count = 0;

  for (const kind of KINDS) {
    for (const e of list(path.join(gh, kind.dir))) {
      const f = path.join(gh, kind.dir, e.name);
      if (!e.isFile()) continue;
      if (!e.name.endsWith(kind.suffix)) {
        problems.push({ file: rel(f), level: "error", msg: `expected suffix ${kind.suffix}` });
        continue;
      }
      count++;
      const name = e.name.slice(0, -kind.suffix.length);
      if (!NAME_RE.test(name)) problems.push({ file: rel(f), level: "error", msg: "invalid name" });
      const text = read(f);
      checkContent(rel(f), text, problems);
      if (kind.json) {
        try { JSON.parse(text); } catch (x) { problems.push({ file: rel(f), level: "error", msg: `invalid JSON: ${x.message}` }); }
      } else checkMarkdown(rel(f), text, kind, name, problems);
    }
  }

  for (const e of list(path.join(gh, "skills"))) {
    const f = path.join(gh, "skills", e.name, "SKILL.md");
    if (!e.isDirectory()) continue;
    count++;
    if (!fs.existsSync(f)) { problems.push({ file: rel(path.join(gh, "skills", e.name)), level: "error", msg: "missing SKILL.md" }); continue; }
    const text = read(f);
    checkContent(rel(f), text, problems);
    checkMarkdown(rel(f), text, { required: ["name", "description"], name: true }, e.name, problems);
  }

  for (const f of [path.join(gh, "copilot-instructions.md"), path.join(root, "AGENTS.md")]) {
    if (!fs.existsSync(f)) continue;
    count++;
    const text = read(f);
    checkContent(rel(f), text, problems);
    if (!text.trim()) problems.push({ file: rel(f), level: "error", msg: "file is empty" });
  }
  return { count, problems };
}

module.exports = { validate, frontmatter };

if (require.main === module) {
  const { count, problems } = validate(path.resolve(process.argv[2] || "."));
  for (const p of problems) console.log(`${p.level.toUpperCase()}  ${p.file}: ${p.msg}`);
  console.log(`\nChecked ${count} artifact(s): ${problems.length} problem(s).`);
  process.exit(problems.length ? 1 : 0);
}
