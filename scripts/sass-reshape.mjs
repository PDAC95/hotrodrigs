// THROWAWAY (Phase 10) — deleted in 10-04.
// Reshapes the sass-migrator output to the locked wildcard shape:
//   - collapses per-file namespaced abstracts headers
//     (`@use "../../abstracts/functions";` etc., in any combination)
//     into a single `@use "<rel>/abstracts" as *;` first header line
//   - handles the depth-0 edge case (_extra.scss sits NEXT TO abstracts/:
//     its header has zero `../` -> `@use "abstracts" as *;`)
//   - strips the migrator namespaces from references:
//     `functions.` / `mixins.` / `variable.` -> ``
//   - byte-preserving line endings: string splices only, the matched line's
//     own terminator is reused; never rewrites untouched bytes (CRLF-safe).
// Skips: abstracts/** (the module itself) and main.scss (entry stays as-is).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "assets",
  "sass"
);

/** Recursively list .scss files under dir. */
function listScss(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listScss(full));
    else if (entry.isFile() && entry.name.endsWith(".scss")) out.push(full);
  }
  return out;
}

// `@use "abstracts/xxx";` with 0+ `../` segments, capturing the rel prefix
// and the line terminator so the splice reuses the file's own endings.
const HEADER_RE =
  /[^\S\r\n]*@use "((?:\.\.\/)*)abstracts\/(?:css-index|functions|variable|mixins)";[^\S\r\n]*(\r?\n)?/g;

// migrator namespace references: functions.clampCal(...), mixins.md, variable.$colors
const NS_RE = /\b(?:functions|mixins|variable)\.(?=[$a-zA-Z])/g;

const files = listScss(ROOT).filter((f) => {
  const rel = path.relative(ROOT, f).replace(/\\/g, "/");
  if (rel === "main.scss") return false;
  if (rel.startsWith("abstracts/")) return false;
  return true;
});

let touched = 0;
for (const file of files) {
  const original = fs.readFileSync(file, "utf8");
  let content = original;

  const matches = [...content.matchAll(HEADER_RE)];
  if (matches.length > 0) {
    const prefix = matches[0][1]; // "", "../", "../../", ...
    const eol = matches[0][2] ?? ""; // reuse the first header's own terminator
    const wildcard = `@use "${prefix}abstracts" as *;${eol}`;
    let first = true;
    content = content.replace(HEADER_RE, () => {
      if (first) {
        first = false;
        return wildcard;
      }
      return ""; // drop the extra headers (including their own newline)
    });
  }

  content = content.replace(NS_RE, "");

  if (content !== original) {
    fs.writeFileSync(file, content);
    touched++;
    console.log(`reshaped: ${path.relative(ROOT, file)}`);
  }
}
console.log(`done — ${touched} file(s) reshaped`);
