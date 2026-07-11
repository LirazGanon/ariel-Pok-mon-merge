/**
 * One-off, idempotent sprite downloader. Fetches official-artwork PNGs for every
 * species in the pokedex into /public/assets/pokemon/{dexId}.png so the game can
 * run fully offline (PWA) without hitting the network at runtime.
 *
 * Usage:  npm run fetch-sprites
 *
 * Note: Pokémon sprites are © Nintendo / Game Freak / The Pokémon Company and are
 * used here for a personal, non-commercial project only.
 */
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { POKEDEX } from '../src/data/pokedex';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'assets', 'pokemon');

async function exists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.size > 0;
  } catch {
    return false;
  }
}

async function fetchWithRetry(url: string, retries = 3): Promise<ArrayBuffer> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.arrayBuffer();
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastErr;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  let downloaded = 0;
  let skipped = 0;

  for (const species of POKEDEX) {
    const out = join(OUT_DIR, `${species.dexId}.png`);
    if (await exists(out)) {
      skipped++;
      continue;
    }
    const url = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${species.dexId}.png`;
    try {
      const buf = await fetchWithRetry(url);
      await writeFile(out, Buffer.from(buf));
      downloaded++;
      console.log(`✓ ${species.displayName} (#${species.dexId})`);
    } catch (err) {
      console.error(`✗ ${species.displayName} (#${species.dexId}):`, err);
    }
  }

  console.log(`\nDone. Downloaded ${downloaded}, skipped ${skipped} existing.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
