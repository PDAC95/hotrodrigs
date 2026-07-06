// scripts/find-orphans.mjs — run: node scripts/find-orphans.mjs
//
// Mechanical import-graph orphan finder (CLN-03).
// Transitive walk from every src/app/** entry file (.js/.jsx/.mjs) through
// `@/` alias and relative import specifiers across `import ... from`,
// dynamic `import()`, and `require()`. Anything under src/components/** or
// src/helper/** not reached by the walk is an orphan.
//
// Informational only (always exits 0) — deletion stays a reviewed step.
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve("src");

function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const f = path.join(d, e.name);
    return e.isDirectory() ? walk(f) : /\.(jsx?|mjs)$/.test(e.name) ? [f] : [];
  });
}

const entries = walk(path.join(SRC, "app")); // post-deletion tree = only kept routes

const EXT = ["", ".jsx", ".js", ".mjs", "/index.jsx", "/index.js"];
function resolve(spec, from) {
  const base = spec.startsWith("@/")
    ? path.join(SRC, spec.slice(2))
    : spec.startsWith(".")
      ? path.resolve(path.dirname(from), spec)
      : null;
  if (!base) return null;
  return (
    EXT.map((e) => base + e).find(
      (c) => fs.existsSync(c) && fs.statSync(c).isFile()
    ) ?? null
  );
}

const seen = new Set();
const queue = [...entries];
while (queue.length) {
  const f = queue.pop();
  if (seen.has(f)) continue;
  seen.add(f);
  const re =
    /(?:import\s[^'"]*from\s*|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;
  for (const m of fs.readFileSync(f, "utf8").matchAll(re)) {
    const r = resolve(m[1], f);
    if (r && !seen.has(r)) queue.push(r);
  }
}

const all = [
  ...walk(path.join(SRC, "components")),
  ...walk(path.join(SRC, "helper")),
];
const orphans = all.filter((f) => !seen.has(f));
console.log(
  orphans.length
    ? orphans.map((f) => path.relative(SRC, f)).join("\n")
    : "no orphans"
);
process.exitCode = 0; // informational; deletion is a human-reviewed step
