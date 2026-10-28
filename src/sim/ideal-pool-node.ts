import { buildSync } from "esbuild";
import { cpus, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { IdealPool } from "./ideal-pool";

// The pool for Node scripts and tests: worker threads. The worker is bundled once into one plain JavaScript file, so each thread only has to load it
// (running the TypeScript through a loader in every thread cost more than the first second of the search itself).
let bundled: string | null = null;
function workerFile(): string {
  if (bundled) return bundled;
  const outfile = join(tmpdir(), `cc-ideal-eval-${process.pid}.mjs`);
  buildSync({ entryPoints: [fileURLToPath(new URL("./ideal-eval-node.ts", import.meta.url))], bundle: true, platform: "node", format: "esm", outfile, logLevel: "silent" });
  return (bundled = outfile);
}

export function nodePool(size: number = Math.max(1, cpus().length)): IdealPool {
  const file = pathToFileURL(workerFile());
  return new IdealPool(() => {
    const w = new Worker(file);
    return { post: (m) => w.postMessage(m), listen: (cb) => { w.on("message", cb); }, stop: () => { void w.terminate(); } };
  }, size);
}
