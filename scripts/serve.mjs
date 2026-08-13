import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const routes = new Map([
  ["/", ["demo/index.html", "text/html; charset=utf-8"]],
  ["/demo", ["demo/index.html", "text/html; charset=utf-8"]],
  ["/demo/", ["demo/index.html", "text/html; charset=utf-8"]],
  ["/demo/index.html", ["demo/index.html", "text/html; charset=utf-8"]],
  ["/demo/app.js", ["demo/app.js", "text/javascript; charset=utf-8"]],
  ["/demo/styles.css", ["demo/styles.css", "text/css; charset=utf-8"]],
  ["/src/engine.mjs", ["src/engine.mjs", "text/javascript; charset=utf-8"]]
]);

const securityHeaders = {
  "cache-control": "no-store",
  "content-security-policy": "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'",
  "x-content-type-options": "nosniff"
};

function reply(response, status, body, headers = {}) {
  response.writeHead(status, { "content-type": "text/plain; charset=utf-8", ...securityHeaders, ...headers });
  response.end(body);
}

export function createDemoServer() {
  return createServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      reply(response, 405, request.method === "HEAD" ? undefined : "Method not allowed", { allow: "GET, HEAD" });
      return;
    }

    try {
      const rawPath = (request.url ?? "/").split("?", 1)[0];
      const decodedPath = decodeURIComponent(rawPath);
      if (decodedPath.includes("\\") || decodedPath.includes("\0") || decodedPath.split("/").includes("..")) {
        reply(response, 404, request.method === "HEAD" ? undefined : "Not found");
        return;
      }

      const route = routes.get(decodedPath);
      if (!route) {
        reply(response, 404, request.method === "HEAD" ? undefined : "Not found");
        return;
      }

      const [relative, contentType] = route;
      const body = await readFile(join(root, relative));
      response.writeHead(200, { ...securityHeaders, "content-type": contentType, "content-length": body.length });
      response.end(request.method === "HEAD" ? undefined : body);
    } catch {
      reply(response, 404, request.method === "HEAD" ? undefined : "Not found");
    }
  });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  createDemoServer().listen(8080, "127.0.0.1", () => {
    console.log("GovFlow demo: http://127.0.0.1:8080/demo/");
  });
}
