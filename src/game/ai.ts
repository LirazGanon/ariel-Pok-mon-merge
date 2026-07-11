import type { PokemonSpecies, StageConfig, UnitInstance } from '../types';
import { POKEDEX, getSpecies } from '../data/pokedex';
import { unitPower } from './stats';
import { makeRng, pick, weightedPick } from './rng';
import { BOARD_COLS, ENEMY_ROWS, ENEMY_FRONT_ROW } from './constants';

/** Sum of the abstract power of a set of units. */
export function computePower(units: UnitInstance[]): number {
  return units.reduce((sum, u) => sum + unitPower(getSpecies(u.speciesId), u.finish), 0);
}

export interface DifficultyState {
  winStreak: number;
  lossStreakAtStage: number;
}

/**
 * Dynamic difficulty. The enemy budget is anchored to BOTH a steep fixed stage
 * curve and the player's own power (rubber-banding), so it keeps up with players
 * who over-build. Streaks push it harder, a pity system eases it after repeated
 * losses, and boss stages get an extra bump.
 */
export function computeEnemyBudget(
  stage: StageConfig,
  playerPower: number,
  diff: DifficultyState,
): number {
  const n = stage.stageNumber;

  // Base factor relative to the player's army: the enemy is deliberately a bit
  // STRONGER than you in the mid/late game, so raw power alone is not enough —
  // you win through positioning, type counters, merges and finishes.
  let factor: number;
  if (n <= 2) factor = 0.85;
  else if (n <= 4) factor = 1.0;
  else if (n <= 6) factor = 1.05;
  else if (n <= 9) factor = 1.12;
  else if (n <= 15) factor = 1.18;
  else factor = 1.28;

  // Win streak makes it progressively harder (up to +30%).
  factor += Math.min(diff.winStreak, 6) * 0.05;

  // Pity: repeated losses on this stage make it easier.
  if (diff.lossStreakAtStage >= 2) factor -= 0.14;
  if (diff.lossStreakAtStage >= 4) factor -= 0.24;

  // Boss stages get a deliberate bump.
  if (stage.isBossStage) factor += 0.15;

  // Anchor to the player's CURRENT army power (recomputed as they build), with a
  // steep stage-curve floor so an under-built army still faces a real fight.
  const base = Math.max(stage.budget, playerPower);
  const budget = base * factor;

  const min = stage.budget * 0.7;
  const max = stage.budget * 3 + playerPower * 2;
  return Math.max(min, Math.min(max, budget));
}

type Archetype = 'balanced' | 'rush' | 'tanky' | 'highroll';

function speciesPoolForStage(stage: StageConfig): PokemonSpecies[] {
  return POKEDEX.filter((s) => s.tier <= stage.enemyMaxTier);
}

function isTank(s: PokemonSpecies): boolean {
  return s.stats.def >= s.stats.atk || s.stats.hp >= 120;
}

/**
 * Builds the enemy army: a knapsack-like fill up to the budget that prefers
 * fielding fewer, higher-rung units (mimicking a merged army) while honouring
 * composition rules — at least one tank up front and some type variety.
 */
export function generateEnemyArmy(stage: StageConfig, budget: number, seed: number): UnitInstance[] {
  const rng = makeRng(seed);
  const pool = speciesPoolForStage(stage);
  const archetype: Archetype = pick(rng, ['balanced', 'rush', 'tanky', 'highroll'] as const);
  const capacity = stage.unitCap;

  const chosen: PokemonSpecies[] = [];
  const usedTypes = new Set<string>();
  let spent = 0;

  // Guarantee one tank in the front.
  const tanks = pool.filter(isTank);
  if (tanks.length > 0) {
    const affordableTanks = tanks.filter((t) => unitPower(t) <= budget);
    const tank = pick(rng, affordableTanks.length ? affordableTanks : tanks);
    chosen.push(tank);
    usedTypes.add(tank.type);
    spent += unitPower(tank);
  }

  const cheapest = Math.min(...pool.map((p) => unitPower(p)));

  const weightFor = (s: PokemonSpecies, remaining: number): number => {
    const cost = unitPower(s);
    if (cost > remaining * 1.1) return 0;
    let w = 1;
    // Prefer spending a large fraction of the remaining budget on one strong
    // unit ("highroll"/balanced) vs many cheap ones ("rush").
    const frac = cost / Math.max(remaining, 1);
    if (archetype === 'highroll') w += frac * 4;
    if (archetype === 'balanced') w += frac * 2;
    if (archetype === 'rush' && s.stats.spd >= 1.1) w += 1.5;
    if (archetype === 'tanky' && isTank(s)) w += 2;
    if (!usedTypes.has(s.type)) w += 0.8; // encourage type variety
    return Math.max(0.05, w);
  };

  let guard = 0;
  while (chosen.length < capacity && spent < budget && guard++ < 300) {
    const remaining = budget - spent;
    if (remaining < cheapest * 0.9) break;
    const weights = pool.map((s) => weightFor(s, remaining));
    if (weights.every((w) => w <= 0)) break;
    const s = weightedPick(rng, pool, weights);
    chosen.push(s);
    usedTypes.add(s.type);
    spent += unitPower(s);
  }

  return placeEnemyArmy(chosen, rng);
}

/** Places enemy units: tanks/melee on the front enemy row, ranged behind. */
function placeEnemyArmy(chosen: PokemonSpecies[], rng: () => number): UnitInstance[] {
  const frontCols = shuffleCols(rng);
  const backCols = shuffleCols(rng);
  let fi = 0;
  let bi = 0;
  const units: UnitInstance[] = [];

  chosen.forEach((species, idx) => {
    const ranged = species.stats.range >= 2;
    let row: number;
    let col: number;
    if (ranged) {
      row = bi % 2 === 0 ? ENEMY_ROWS[0] : ENEMY_ROWS[1];
      col = backCols[bi++ % BOARD_COLS];
    } else {
      row = ENEMY_FRONT_ROW;
      col = frontCols[fi++ % BOARD_COLS];
    }
    units.push({
      instanceId: `enemy-${idx}-${species.id}`,
      speciesId: species.id,
      owner: 'enemy',
      position: { row, col },
    });
  });

  return units;
}

function shuffleCols(rng: () => number): number[] {
  const cols = Array.from({ length: BOARD_COLS }, (_, i) => i);
  for (let i = cols.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cols[i], cols[j]] = [cols[j], cols[i]];
  }
  return cols;
}
