import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = normalize(join(import.meta.dirname, ".."));
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" };

createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, "http://local").pathname;
    const relative = pathname === "/" ? "demo/index.html" : pathname.replace(/^\//, "");
    let target = normalize(join(root, relative));
    if (!target.startsWith(root)) throw new Error("Invalid path");
    if ((await stat(target)).isDirectory()) target = join(target, "index.html");
    const body = await readFile(target);
    response.writeHead(200, { "content-type": types[extname(target)] || "application/octet-stream", "cache-control": "no-store" });
    response.end(body);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(8080, "127.0.0.1", () => {
  console.log("GovFlow demo: http://127.0.0.1:8080/demo/");
});

