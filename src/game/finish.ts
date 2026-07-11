import { makeRng } from './rng';

/** Special cosmetic-but-powerful finishes that strengthen a Pokémon. */
export type Finish = 'shiny' | 'gold' | 'diamond' | 'rainbow';

export interface FinishMeta {
  label: string; // Hebrew
  emoji: string;
  mult: number; // stat multiplier
  weight: number; // relative chance of appearing in the shop
  rank: number; // higher = better (for merge inheritance)
  cls: string; // css class applied to the sprite
}

export const FINISH_META: Record<Finish, FinishMeta> = {
  shiny: { label: 'שייני', emoji: '✨', mult: 1.25, weight: 6, rank: 1, cls: 'finish-shiny' },
  gold: { label: 'גולד', emoji: '🥇', mult: 1.45, weight: 3.2, rank: 2, cls: 'finish-gold' },
  diamond: { label: 'דיימונד', emoji: '💎', mult: 1.7, weight: 1.6, rank: 3, cls: 'finish-diamond' },
  rainbow: { label: 'ריינבו', emoji: '🌈', mult: 2.1, weight: 0.5, rank: 4, cls: 'finish-rainbow' },
};

const FINISH_ORDER: Finish[] = ['shiny', 'gold', 'diamond', 'rainbow'];
const NONE_WEIGHT = 84;

export function finishMultiplier(finish: Finish | null | undefined): number {
  return finish ? FINISH_META[finish].mult : 1;
}

/** Returns the stronger of two finishes (or null if both are absent). */
export function betterFinish(a: Finish | null | undefined, b: Finish | null | undefined): Finish | null {
  if (!a) return b ?? null;
  if (!b) return a ?? null;
  return FINISH_META[a].rank >= FINISH_META[b].rank ? a : b;
}

/**
 * Rolls a finish for a shop offer. Mostly returns null (plain); specials are
 * rare, and rarer the more powerful they are. `luck` scales the special chance.
 */
export function rollFinish(rng: () => number, luck = 1): Finish | null {
  const items: (Finish | null)[] = [null, ...FINISH_ORDER];
  const weights = [NONE_WEIGHT, ...FINISH_ORDER.map((f) => FINISH_META[f].weight * luck)];
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return null;
}

export function makeFinishRng(seed: number): () => number {
  return makeRng(seed >>> 0);
}
