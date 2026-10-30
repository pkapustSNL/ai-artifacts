#!/usr/bin/env node
// Validates AI artifacts under .github/ (and AGENTS.md). No dependencies.
// Usage: node scripts/validate.js [rootDir]   -> exits 1 if any error is found.
const fs = require("fs");
const path = require("path");

const { NAME_RE, frontmatter, checkContent, checkMarkdown } = require("./core");
const KINDS = [
  { dir: "agents", suffix: ".agent.md", required: ["description"] },
  { dir: "instructions", suffix: ".instructions.md", required: [] },
  { dir: "prompts", suffix: ".prompt.md", required: ["description"] },
  { dir: "hooks", suffix: ".json", json: true },
];
function validate(root) {
  const problems = [];
  const gh = path.join(root, ".github");
  const list = (d) => { try { return fs.readdirSync(d, { withFileTypes: true }); } catch { return []; } };
  const rel = (f) => path.relative(root, f);
  const read = (f) => fs.readFileSync(f, "utf8");
  let count = 0;

  for (const kind of KINDS) {
    // Instructions may be nested in subfolders (parent/child.instructions.md).
    const walk = (d, rel0 = "") => list(d).flatMap((e) =>
      e.isDirectory() && kind.dir === "instructions" ? walk(path.join(d, e.name), rel0 + e.name + "/") : [{ e, rel0 }]);
    for (const { e, rel0 } of walk(path.join(gh, kind.dir))) {
      const f = path.join(gh, kind.dir, rel0, e.name);
      if (!e.isFile()) continue;
      if (!e.name.endsWith(kind.suffix)) {
        problems.push({ file: rel(f), level: "error", msg: `expected suffix ${kind.suffix}` });
        continue;
      }
      count++;
      const name = e.name.slice(0, -kind.suffix.length);
      if (!NAME_RE.test(name) || !rel0.split("/").filter(Boolean).every((x) => NAME_RE.test(x))) problems.push({ file: rel(f), level: "error", msg: "invalid name" });
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
