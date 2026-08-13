import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createDemoServer } from "../scripts/serve.mjs";

async function withServer(run) {
  const server = createDemoServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("serves only allowlisted demo assets and the engine", async () => {
  await withServer(async (origin) => {
    for (const path of ["/", "/demo/", "/demo/app.js", "/demo/styles.css", "/src/engine.mjs"]) {
      const response = await fetch(origin + path);
      assert.equal(response.status, 200, path);
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    }
  });
});

test("rejects repository files, traversal, encoded traversal, and malformed URLs", async () => {
  await withServer(async (origin) => {
    for (const path of ["/.git/config", "/package.json", "/README.md", "/demo/../package.json", "/%2e%2e/package.json", "/demo%2f..%2fpackage.json", "/%ZZ"]) {
      const response = await fetch(origin + path);
      assert.equal(response.status, 404, path);
    }
  });
});

test("HEAD returns headers without a body and unsupported methods return 405", async () => {
  await withServer(async (origin) => {
    const head = await fetch(origin + "/demo/app.js", { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");

    const post = await fetch(origin + "/demo/app.js", { method: "POST" });
    assert.equal(post.status, 405);
    assert.equal(post.headers.get("allow"), "GET, HEAD");
  });
});
