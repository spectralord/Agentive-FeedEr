#!/usr/bin/env node
/**
 * Design-review screenshot helper.
 *
 * Renders a target (running app URL, or a prototype .html on disk) at one or
 * more viewports and writes PNGs, so a design review can compare what is built
 * against docs/specs/prototypes/ visually rather than by reading markup.
 *
 * Playwright IS a devDependency as of 2026-08-01 (it was deliberately not one
 * before; changed by the owner's decision after the first real design review).
 * The documented reason required by docs/plan/README.md §2: the review agent's
 * highest-value checks are the ones only a rendered page can answer, and the
 * first visual pass immediately found two BLOCKERs that build, typecheck and
 * 363 green tests had all missed — a white page background in every non-dark
 * OS scheme, and a Detail overlay whose controls were all unclickable. Leaving
 * it opt-in meant every review started by re-deciding whether to install it.
 *
 * devDependency only — it never ships to Railway.
 *
 * The browser binary is a separate, one-time, machine-level download:
 *
 *     npx playwright install chromium
 *
 * The package must resolve *in this project* — a global install does not work,
 * because Node ignores NODE_PATH and global roots when resolving ESM imports
 * (verified, not assumed). If it is absent the script exits 3 with this
 * message, so a review falls back to a source-only pass instead of silently
 * skipping the check.
 *
 * Usage:
 *   node scripts/design-screenshot.mjs <target> [--out DIR] [--vp phone|tablet|desktop|WxH]... [--full]
 *
 * Examples:
 *   node scripts/design-screenshot.mjs http://localhost:3000/ --vp phone
 *   node scripts/design-screenshot.mjs http://localhost:3000/skills --vp phone --vp desktop
 *   node scripts/design-screenshot.mjs docs/specs/prototypes/nav-ia.html --vp desktop --full
 */

import { pathToFileURL } from "node:url";
import { existsSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";

const VIEWPORTS = {
  // iPhone-ish: the primary target, and where overflow bugs actually show up.
  phone: { width: 375, height: 812 },
  tablet: { width: 834, height: 1112 },
  desktop: { width: 1440, height: 900 },
};

function parseArgs(argv) {
  const args = { target: null, out: "design-shots", viewports: [], full: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") args.out = argv[++i];
    else if (a === "--vp") args.viewports.push(argv[++i]);
    else if (a === "--full") args.full = true;
    else if (!args.target) args.target = a;
  }
  if (args.viewports.length === 0) args.viewports = ["phone"];
  return args;
}

function resolveViewport(name) {
  if (VIEWPORTS[name]) return { name, ...VIEWPORTS[name] };
  const m = /^(\d+)x(\d+)$/.exec(name);
  if (m) return { name, width: +m[1], height: +m[2] };
  throw new Error(`Unknown viewport "${name}". Use phone|tablet|desktop or WxH (e.g. 412x915).`);
}

function toUrl(target) {
  if (/^https?:\/\//.test(target)) return target;
  const abs = resolve(process.cwd(), target);
  if (!existsSync(abs)) throw new Error(`No such file: ${target}`);
  return pathToFileURL(abs).href;
}

const { target, out, viewports, full } = parseArgs(process.argv.slice(2));
if (!target) {
  console.error("Usage: node scripts/design-screenshot.mjs <url|file> [--out DIR] [--vp phone|tablet|desktop|WxH] [--full]");
  process.exit(2);
}

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error(
    "Playwright not found. Opt in once, in this project:\n" +
      "  npm i -D playwright && npx playwright install chromium\n" +
      "A global install will NOT work — Node ignores global roots for ESM imports.\n" +
      "Without it, review from source and say so; do not claim visual verification.",
  );
  process.exit(3);
}

const url = toUrl(target);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const slug = target.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "page";

for (const vpName of viewports) {
  const vp = resolveViewport(vpName);
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    // Reduced motion so animations don't make screenshots non-deterministic.
    reducedMotion: "reduce",
  });
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
  } catch (err) {
    console.error(`FAILED ${url} @ ${vp.name}: ${err.message}`);
    console.error("If this is the app: is the dev server running, and is DATABASE_URL set?");
    await page.close();
    continue;
  }

  const file = join(out, `${slug}-${vp.name}.png`);
  await page.screenshot({ path: file, fullPage: full });

  // Body-level horizontal overflow is the single most common mobile bug here
  // (see design doc §10.1) and is invisible in a viewport-clipped screenshot.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  const warn = overflow > 0 ? `  ⚠ horizontal overflow: ${overflow}px` : "";
  console.log(`${file}  (${vp.width}x${vp.height})${warn}`);
  await page.close();
}

await browser.close();
