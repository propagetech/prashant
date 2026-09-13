#!/usr/bin/env node
/**
 * Palette token audit plus HTML checks (one h1, img alt, no em/en dashes).
 * Full computed-style Playwright audit can be added later (tools/node_modules).
 */
import fs from "node:fs";
import path from "node:path";

function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [r + m, g + m, b + m];
}

function lin(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function lum([r, g, b]) {
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a, b) {
  const L1 = lum(hslToRgb(...a));
  const L2 = lum(hslToRgb(...b));
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

const pairs = [
  ["ink on bg", [38, 35, 93], [32, 18, 7], 4.5],
  ["muted on bg", [35, 14, 74], [32, 18, 7], 4.5],
  ["champagne on bg", [39, 42, 68], [32, 18, 7], 4.5],
  ["ink on elev", [38, 35, 93], [32, 14, 11], 4.5],
  ["btn ink on gold", [32, 18, 8], [39, 48, 62], 4.5],
];

let failed = 0;
for (const [name, fg, bg, min] of pairs) {
  const ratio = contrast(fg, bg);
  const pass = ratio + 1e-6 >= min;
  console.log(`${pass ? "PASS" : "FAIL"}  ${ratio.toFixed(2)}  ${name}`);
  if (!pass) failed += 1;
}

const ROOT = path.resolve(process.cwd());
const skip = new Set([".git", "node_modules", "backend", "fonts"]);

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    if (skip.has(name)) continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(html|css|js|md)$/.test(name) && !p.includes("node_modules")) acc.push(p);
  }
  return acc;
}

const files = walk(ROOT);
for (const file of files) {
  if (file.includes("tools/contrast-audit")) continue;
  const text = fs.readFileSync(file, "utf8");
  if (/[\u2013\u2014]/.test(text)) {
    console.log(`FAIL  em/en dash in ${path.relative(ROOT, file)}`);
    failed += 1;
  }
}

function walkHtml(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    if (skip.has(name) || name === "tools") continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkHtml(p, acc);
    else if (name.endsWith(".html")) acc.push(p);
  }
  return acc;
}

for (const file of walkHtml(ROOT)) {
  const html = fs.readFileSync(file, "utf8");
  const h1 = html.match(/<h1\b/g) || [];
  if (h1.length !== 1) {
    console.log(`FAIL  ${path.relative(ROOT, file)} has ${h1.length} h1`);
    failed += 1;
  } else {
    console.log(`PASS  one h1  ${path.relative(ROOT, file)}`);
  }
  const imgs = html.match(/<img\b[^>]*>/g) || [];
  for (const tag of imgs) {
    if (!/\balt=/.test(tag)) {
      console.log(`FAIL  img missing alt in ${path.relative(ROOT, file)}`);
      failed += 1;
    }
  }
}

if (failed) {
  console.log(`RESULT: FAIL (${failed})`);
  process.exit(1);
}
console.log("RESULT: PASS");
