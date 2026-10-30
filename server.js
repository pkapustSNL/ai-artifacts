const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const WORKSPACE = path.resolve(process.env.WORKSPACE || process.cwd());
const USER_DIR = path.resolve(process.env.USER_DIR || path.join(os.homedir(), ".copilot"));
const PORT = process.env.PORT || 4173;

// base: where agents/, skills/... live; root: where AGENTS.md lives
const SCOPES = {
  workspace: { base: path.join(WORKSPACE, ".github"), root: WORKSPACE },
  user: { base: USER_DIR, root: null },
};

const TYPES = {
  agent: { label: "Agents", file: (n) => `agents/${n}.agent.md`, list: "agents", suffix: ".agent.md" },
  instruction: { label: "Instructions", file: (n) => `instructions/${n}.instructions.md`, list: "instructions", suffix: ".instructions.md" },
  prompt: { label: "Prompts", file: (n) => `prompts/${n}.prompt.md`, list: "prompts", suffix: ".prompt.md" },
  skill: { label: "Skills", file: (n) => `skills/${n}/SKILL.md` },
  hook: { label: "Hooks", file: (n) => `hooks/${n}.json`, list: "hooks", suffix: ".json" },
};

const TEMPLATES = {
  agent: (n) => `---\ndescription: Describe what this agent does\n# tools: ['codebase', 'search']\n---\n\nYou are ${n}. Describe the agent's behavior here.\n`,
  instruction: () => `---\napplyTo: "**"\n---\n\nWrite your instructions here.\n`,
  prompt: () => `---\ndescription: Describe this prompt\n---\n\nWrite your prompt here.\n`,
  skill: (n) => `---\nname: ${n}\ndescription: Describe what this skill does and when to use it\n---\n\n# ${n}\n\nSkill instructions here.\n`,
  hook: () => `{\n  "version": 1,\n  "hooks": {\n    "preToolUse": []\n  }\n}\n`,
};

const NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

const readDir = (d) => { try { return fs.readdirSync(d, { withFileTypes: true }); } catch { return []; } };
const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };

function singletonPath(scope, type, name) {
  const s = SCOPES[scope];
  if (type !== "instruction") return null;
  if (name === "copilot-instructions") return path.join(s.base, "copilot-instructions.md");
  if (name === "AGENTS" && s.root) return path.join(s.root, "AGENTS.md");
  return null;
}

function scan() {
  const items = [];
  for (const [scope, s] of Object.entries(SCOPES)) {
    const add = (type, name, file) =>
      items.push({ id: Buffer.from(file).toString("base64url"), scope, type, name, path: file });
    for (const [type, t] of Object.entries(TYPES)) {
      if (type === "skill") {
        for (const e of readDir(path.join(s.base, "skills"))) {
          const f = path.join(s.base, "skills", e.name, "SKILL.md");
          if (e.isDirectory() && isFile(f)) add(type, e.name, f);
        }
      } else {
        for (const e of readDir(path.join(s.base, t.list))) {
          if (e.isFile() && e.name.endsWith(t.suffix)) add(type, e.name.slice(0, -t.suffix.length), path.join(s.base, t.list, e.name));
        }
      }
    }
    for (const n of ["copilot-instructions", "AGENTS"]) {
      const f = singletonPath(scope, "instruction", n);
      if (f && isFile(f)) add("instruction", n, f);
    }
  }
  return items;
}

const find = (id) => scan().find((i) => i.id === id);

function send(res, code, body) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = "";
    req.on("data", (c) => { d += c; if (d.length > 5e6) req.destroy(); });
    req.on("end", () => { try { resolve(JSON.parse(d || "{}")); } catch (e) { reject(e); } });
  });
}

const server = http.createServer(async (req, res) => {
  // Reject cross-site / DNS-rebinding requests so a web page can't write local files
  const host = req.headers.host || "";
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) return send(res, 403, { error: "forbidden" });
  const origin = req.headers.origin;
  if (origin && new URL(origin).host !== host) return send(res, 403, { error: "forbidden" });

  const url = new URL(req.url, "http://x");
  try {
    if (req.method === "GET" && url.pathname === "/api/meta") {
      return send(res, 200, {
        workspace: WORKSPACE, user: USER_DIR,
        types: Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [k, v.label])),
      });
    }
    if (req.method === "GET" && url.pathname === "/api/artifacts") return send(res, 200, scan());
    if (req.method === "GET" && url.pathname === "/api/artifact") {
      const a = find(url.searchParams.get("id"));
      if (!a) return send(res, 404, { error: "not found" });
      return send(res, 200, { ...a, content: fs.readFileSync(a.path, "utf8") });
    }
    if (req.method === "PUT" && url.pathname === "/api/artifact") {
      const { id, content } = await readBody(req);
      const a = find(id);
      if (!a || typeof content !== "string") return send(res, 404, { error: "not found" });
      fs.writeFileSync(a.path, content);
      return send(res, 200, a);
    }
    if (req.method === "POST" && url.pathname === "/api/artifact") {
      const { scope, type, name, content } = await readBody(req);
      if (!SCOPES[scope] || !TYPES[type] || !NAME_RE.test(name || "")) return send(res, 400, { error: "invalid scope, type or name" });
      const file = singletonPath(scope, type, name) || path.join(SCOPES[scope].base, TYPES[type].file(name));
      if (fs.existsSync(file)) return send(res, 409, { error: "already exists" });
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, typeof content === "string" ? content : TEMPLATES[type](name));
      return send(res, 201, find(Buffer.from(file).toString("base64url")));
    }
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end(fs.readFileSync(path.join(__dirname, "index.html")));
    }
    send(res, 404, { error: "not found" });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`AI Artifacts manager: http://localhost:${PORT}\n workspace: ${WORKSPACE}\n user: ${USER_DIR}`);
});
