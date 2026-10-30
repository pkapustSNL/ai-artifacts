const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { validate } = require("../scripts/validate");

function repo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "art-"));
  for (const [p, c] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true });
    fs.writeFileSync(path.join(root, p), c);
  }
  return root;
}
const msgs = (r) => r.problems.map((p) => p.msg).join("|");

test("valid artifacts pass", () => {
  const r = validate(repo({
    ".github/agents/rev.agent.md": "---\ndescription: Reviews code\n---\nReview carefully.\n",
    ".github/skills/demo/SKILL.md": "---\nname: demo\ndescription: Does demo things\n---\nSteps.\n",
    ".github/hooks/h.json": '{"version":1}',
  }));
  assert.equal(r.count, 3);
  assert.deepEqual(r.problems, []);
});

test("agent without description fails", () => {
  const r = validate(repo({ ".github/agents/a.agent.md": "---\ntools: []\n---\nBody\n" }));
  assert.match(msgs(r), /"description" is required/);
});

test("missing frontmatter fails for agents", () => {
  const r = validate(repo({ ".github/agents/a.agent.md": "just text" }));
  assert.match(msgs(r), /missing YAML frontmatter/);
});

test("skill name must match folder and SKILL.md must exist", () => {
  const r = validate(repo({
    ".github/skills/one/SKILL.md": "---\nname: two\ndescription: x y\n---\nBody\n",
    ".github/skills/empty/notes.txt": "x",
  }));
  assert.match(msgs(r), /must match folder/);
  assert.match(msgs(r), /missing SKILL.md/);
});

test("invalid JSON hook fails", () => {
  const r = validate(repo({ ".github/hooks/h.json": "{nope" }));
  assert.match(msgs(r), /invalid JSON/);
});

test("secrets are detected", () => {
  const r = validate(repo({
    ".github/instructions/i.instructions.md": "---\napplyTo: '**'\n---\nUse ghp_abcdefghijklmnopqrstuvwxyz0123456789 here\n",
  }));
  assert.match(msgs(r), /GitHub token/);
});

test("template placeholder text is flagged", () => {
  const r = validate(repo({ ".github/prompts/p.prompt.md": "---\ndescription: Describe this prompt\n---\nWrite your prompt here.\n" }));
  assert.match(msgs(r), /placeholder/);
});

test("wrong suffix and bad names are flagged", () => {
  const r = validate(repo({ ".github/agents/a.md": "x", ".github/agents/-bad.agent.md": "---\ndescription: d\n---\nb\n" }));
  assert.match(msgs(r), /expected suffix/);
  assert.match(msgs(r), /invalid name/);
});

test("empty repo has no problems", () => {
  assert.deepEqual(validate(repo({})).problems, []);
});
