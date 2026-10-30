const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

test("server lists and creates nested instructions", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "srv-"));
  const user = fs.mkdtempSync(path.join(os.tmpdir(), "usr-"));
  const dir = path.join(ws, ".github/instructions/parent");
  fs.mkdirSync(path.join(dir, "kid"), { recursive: true });
  fs.writeFileSync(path.join(ws, ".github/instructions/parent.instructions.md"), "x");
  fs.writeFileSync(path.join(dir, "child.instructions.md"), "x");
  fs.writeFileSync(path.join(dir, "kid/deep.instructions.md"), "x");
  const port = 4300 + Math.floor(Math.random() * 500);
  const p = spawn(process.execPath, [path.join(__dirname, "../server.js")], { env: { ...process.env, WORKSPACE: ws, USER_DIR: user, PORT: port } });
  try {
    await new Promise((r) => p.stdout.once("data", r));
    const base = `http://localhost:${port}/api/artifact`;
    const list = await (await fetch(`http://localhost:${port}/api/artifacts`)).json();
    const names = list.filter((i) => i.type === "instruction").map((i) => i.name).sort();
    assert.deepEqual(names, ["parent", "parent/child", "parent/kid/deep"]);
    const post = (name) => fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: "workspace", type: "instruction", name }) });
    assert.equal((await post("parent/new")).status, 201);
    assert.ok(fs.existsSync(path.join(dir, "new.instructions.md")));
    assert.equal((await post("a/b/c/d")).status, 400);
    assert.equal((await post("a/../b")).status, 400);
    assert.equal((await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: "workspace", type: "agent", name: "a/b" }) })).status, 400);
  } finally { p.kill(); }
});
