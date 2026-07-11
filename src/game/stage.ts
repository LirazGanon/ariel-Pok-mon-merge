import type { StageConfig } from '../types';
import { LADDER_LENGTH } from '../data/pokedex';

/**
 * Derives the configuration for a given stage: the enemy power budget, the
 * highest ladder rung the shop / enemy may use, the board unit cap, and whether
 * it is a boss stage. The budget curve is deliberately steep so the game keeps
 * ramping up in challenge.
 */
export function getStageConfig(stageNumber: number): StageConfig {
  // Steep growth so later stages are genuinely demanding.
  const budget = 26 * Math.pow(1.26, stageNumber - 1);

  // The enemy's highest rung follows the balanced difficulty curve.
  const enemyMaxTier = Math.min(
    LADDER_LENGTH,
    2 + Math.floor((stageNumber - 1) / 2) + (stageNumber >= 5 ? 1 : 0),
  );

  // The shop always offers at least 5 distinct species for variety, and a bit
  // above the enemy tier so you can buy up to counter it (cheap ones dominate).
  const shopMaxTier = Math.min(LADDER_LENGTH, Math.max(5, enemyMaxTier + 1));

  let unitCap = 4;
  if (stageNumber >= 4) unitCap = 5;
  if (stageNumber >= 8) unitCap = 6;
  if (stageNumber >= 14) unitCap = 7;
  if (stageNumber >= 22) unitCap = 8;

  const isBossStage = stageNumber % 10 === 0;

  return { stageNumber, budget, shopMaxTier, enemyMaxTier, unitCap, isBossStage };
}

