import type { WheelPrize, WheelPrizeKind } from '../types';
import { weightedPick } from './rng';

export const WHEEL_PRIZES: WheelPrize[] = [
  { kind: 'goldSmall', label: 'מטבעות', weight: 42, color: '#4caf50' },
  { kind: 'goldMedium', label: 'מטבעות +', weight: 26, color: '#2196f3' },
  { kind: 'evolveStone', label: 'אבן אבולוציה', weight: 16, color: '#9c27b0' },
  { kind: 'tier2Unit', label: 'פוקימון משודרג', weight: 10, color: '#ff9800' },
  { kind: 'tier3Unit', label: 'פוקימון חזק', weight: 5, color: '#e91e63' },
  { kind: 'jackpot', label: 'ג׳קפוט!', weight: 1, color: '#ffd700' },
];

const RARE_PLUS: WheelPrizeKind[] = ['tier3Unit', 'jackpot'];
export const PITY_THRESHOLD = 20;

export interface WheelResult {
  prizeIndex: number;
  prize: WheelPrize;
  newPityCounter: number;
}

/**
 * Spins the wheel. Honours a pity system: after PITY_THRESHOLD dry spins
 * (no rare+), the next spin is guaranteed a strong unit or better.
 */
export function spinWheel(pityCounter: number, rng: () => number): WheelResult {
  let prize: WheelPrize;

  if (pityCounter >= PITY_THRESHOLD) {
    const rarePlus = WHEEL_PRIZES.filter((p) => RARE_PLUS.includes(p.kind));
    prize = weightedPick(
      rng,
      rarePlus,
      rarePlus.map((p) => p.weight),
    );
  } else {
    prize = weightedPick(
      rng,
      WHEEL_PRIZES,
      WHEEL_PRIZES.map((p) => p.weight),
    );
  }

  const isRarePlus = RARE_PLUS.includes(prize.kind);
  const newPityCounter = isRarePlus ? 0 : pityCounter + 1;
  const prizeIndex = WHEEL_PRIZES.findIndex((p) => p.kind === prize.kind);

  return { prizeIndex, prize, newPityCounter };
}
