// Download every model's Wikimedia Commons photo once and store it on this site
// (public/products/*.webp, 480 and 960 px wide), then list them in lib/photo-manifest.ts
// so the storefront serves our own copies instead of hotlinking Commons.
//
// Run it from your own computer (Commons rate-limits cloud servers):
//   npx tsx scripts/fetch-photos.mts            download missing photos
//   npx tsx scripts/fetch-photos.mts --force    re-download everything
// Then commit public/products/ and lib/photo-manifest.ts.
//
// Photos keep their Commons licences; credits stay on each product page and /credits.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { models } from "../lib/models";
import { localPhotoName, photoUrl } from "../lib/photos";

const OUT = join(process.cwd(), "public", "products");
const MANIFEST = join(process.cwd(), "lib", "photo-manifest.ts");
const WIDTHS = [480, 960] as const;
// Commons asks automated clients to identify themselves with a contact URL.
const USER_AGENT = "JDHubPhotoSync/1.0 (+https://github.com/ExpectationsHACK/jdhubplug) node-fetch";
const force = process.argv.includes("--force");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function download(file: string): Promise<Buffer> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(photoUrl(file, 1280), { headers: { "User-Agent": USER_AGENT }, redirect: "follow" });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if (res.status === 429 || res.status >= 500) {
      const wait = Number(res.headers.get("retry-after")) * 1000 || 2000 * 2 ** attempt;
      console.log(`  ${res.status}, waiting ${Math.round(wait / 1000)}s`);
      await sleep(wait);
      continue;
    }
    throw new Error(`HTTP ${res.status}`);
  }
  throw new Error("gave up after 5 attempts");
}

mkdirSync(OUT, { recursive: true });
const files = [...new Set(models.map((m) => m.photo).filter(Boolean))] as string[];
const done: string[] = [];
const failed: string[] = [];

for (const [i, file] of files.entries()) {
  const name = localPhotoName(file);
  const targets = WIDTHS.map((w) => join(OUT, `${name}-${w}.webp`));
  if (!force && targets.every((t) => existsSync(t))) {
    done.push(file);
    continue;
  }
  process.stdout.write(`[${i + 1}/${files.length}] ${file}\n`);
  try {
    const original = await download(file);
    for (const [k, w] of WIDTHS.entries()) {
      await sharp(original).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toFile(targets[k]);
    }
    done.push(file);
  } catch (e) {
    console.warn(`  skipped: ${e instanceof Error ? e.message : e}`);
    failed.push(file);
  }
  await sleep(1000); // be gentle with Commons
}

const previous = existsSync(MANIFEST) ? readFileSync(MANIFEST, "utf8") : "";
const manifest = `// Product photos stored on this site (public/products/), written by scripts/fetch-photos.mts.
// A photo listed here is served from our own domain (fast, never rate-limited);
// anything else falls back to Wikimedia Commons. Generated file: don't edit by hand.

export const LOCAL_PHOTOS: ReadonlySet<string> = new Set<string>(${JSON.stringify(done.sort(), null, 2)});
`;
if (manifest !== previous) writeFileSync(MANIFEST, manifest);
console.log(`\n${done.length} photos stored, ${failed.length} failed${failed.length ? `: ${failed.join(", ")}` : ""}.`);
