/**
 * Balance harness (GDD Epic 6.6). Estimates the player win-rate per stage by
 * pitting a baseline "reasonable" player army against the AI-generated enemy,
 * running many head-less simulations. Flags stages that fall outside the target
 * win-rate bands from the GDD (§12).
 *
 * Usage:  npx tsx scripts/balance.ts
 */
import type { UnitInstance } from '../src/types';
import { getStageConfig } from '../src/game/stage';
import { computeEnemyBudget, generateEnemyArmy, computePower } from '../src/game/ai';
import { simulateToEnd } from '../src/game/battle';
import { PLAYER_ROWS, PLAYER_FRONT_ROW } from '../src/game/constants';
import { getSpecies } from '../src/data/pokedex';

const RUNS_PER_STAGE = 400;

/** Mirrors an AI-built army onto the player side (front melee, back ranged). */
function toPlayerArmy(enemyLike: UnitInstance[]): UnitInstance[] {
  return enemyLike.map((u, i) => {
    const ranged = getSpecies(u.speciesId).stats.range >= 2;
    const row = ranged ? PLAYER_ROWS[PLAYER_ROWS.length - 1] : PLAYER_FRONT_ROW;
    return {
      ...u,
      instanceId: `player-${i}`,
      owner: 'player' as const,
      position: { row, col: u.position ? u.position.col : i },
    };
  });
}

interface Band {
  min: number;
  max: number;
}
function targetBand(stage: number): Band {
  if (stage <= 2) return { min: 0.68, max: 0.9 };
  if (stage <= 4) return { min: 0.52, max: 0.75 };
  return { min: 0.38, max: 0.58 }; // fair mirror fight; skilled play trends higher
}

function run() {
  console.log('stage | winrate | target        | status');
  console.log('------+---------+---------------+-------');
  for (let stage = 1; stage <= 30; stage++) {
    const cfg = getStageConfig(stage);
    let wins = 0;

    for (let r = 0; r < RUNS_PER_STAGE; r++) {
      // Model a "reasonable" player who fills their board and merges a bit, so
      // their army is worth clearly more than the stage's nominal budget.
      const playerSeed = (stage * 1000 + r) >>> 0;
      const playerBudget = cfg.budget * 1.6;
      const playerLike = generateEnemyArmy(cfg, playerBudget, playerSeed);
      const playerArmy = toPlayerArmy(playerLike);

      const playerPower = computePower(playerArmy);
      const budget = computeEnemyBudget(cfg, playerPower, {
        winStreak: 0,
        lossStreakAtStage: 0,
      });
      const enemyArmy = generateEnemyArmy(cfg, budget, (playerSeed ^ 0x1234) >>> 0);

      const winner = simulateToEnd(playerArmy, enemyArmy, (playerSeed ^ 0x9999) >>> 0);
      if (winner === 'player') wins++;
    }

    const winrate = wins / RUNS_PER_STAGE;
    const band = targetBand(stage);
    const ok = winrate >= band.min && winrate <= band.max;
    console.log(
      `${String(stage).padStart(5)} | ${(winrate * 100).toFixed(1).padStart(6)}% | ` +
        `${(band.min * 100).toFixed(0)}-${(band.max * 100).toFixed(0)}%`.padEnd(13) +
        ` | ${ok ? 'OK' : '⚠️  CHECK'}`,
    );
  }
}

run();
