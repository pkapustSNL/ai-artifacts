// Pure validation helpers shared by scripts/validate.js (Node) and index.html (browser).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ArtifactCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
const NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
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


const KIND_RULES = {
  agent: { required: ["description"] },
  instruction: { required: [] },
  prompt: { required: ["description"] },
  skill: { required: ["name", "description"], name: true },
};

// Checks one artifact file. type: agent|instruction|prompt|skill|hook; expectedName is the skill folder name.
function checkFile(type, file, text, expectedName, singleton) {
  const problems = [];
  checkContent(file, text, problems);
  if (type === "hook") {
    try { JSON.parse(text); } catch (x) { problems.push({ file, level: "error", msg: `invalid JSON: ${x.message}` }); }
  } else if (singleton) {
    if (!text.trim()) problems.push({ file, level: "error", msg: "file is empty" });
  } else if (KIND_RULES[type]) checkMarkdown(file, text, KIND_RULES[type], expectedName, problems);
  return problems;
}

return { NAME_RE, SECRETS, PLACEHOLDERS, frontmatter, checkContent, checkMarkdown, checkFile };
});
