import type { Owner, UnitInstance } from '../types';
import { getSpecies } from '../data/pokedex';
import { getTypeMultiplier } from '../data/typeChart';
import { computeStats } from './stats';
import { makeRng } from './rng';
import type { Finish, PokemonType } from '../types';

export const TICK_RATE = 15; // simulation ticks per second
export const TICK_DT = 1 / TICK_RATE;
const MOVE_SPEED = 2.2; // grid cells per second
const CRIT_CHANCE = 0.05;
const CRIT_MULT = 1.6;
const MAX_BATTLE_SECONDS = 45;
const MANA_PER_ATTACK = 25;
const MANA_MAX = 100;

export interface BattleUnit {
  id: string;
  speciesId: string;
  type: PokemonType;
  owner: Owner;
  tier: number;
  finish: Finish | null;
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  range: number;
  x: number; // fractional column
  y: number; // fractional row
  targetId: string | null;
  cooldown: number; // seconds until next attack
  mana: number;
  alive: boolean;
  // Transient render hints:
  hitFlash: number; // ticks remaining to show a hit flash
  superFlash: number; // ticks remaining to show a super-effective hit
  attackLunge: number; // ticks remaining to show an attack lunge
  ultFlash: number; // ticks remaining to show ultimate cast
}

export interface BattleState {
  units: BattleUnit[];
  elapsed: number;
  finished: boolean;
  winner: Owner | null;
  rng: () => number;
}

function toBattleUnit(u: UnitInstance): BattleUnit {
  const species = getSpecies(u.speciesId);
  const stats = computeStats(species, u.finish);
  const pos = u.position!;
  return {
    id: u.instanceId,
    speciesId: u.speciesId,
    type: species.type,
    owner: u.owner,
    tier: species.tier,
    finish: u.finish ?? null,
    maxHp: stats.maxHp,
    hp: stats.maxHp,
    atk: stats.atk,
    def: stats.def,
    spd: stats.spd,
    range: stats.range,
    x: pos.col,
    y: pos.row,
    targetId: null,
    cooldown: 0,
    mana: 0,
    alive: true,
    hitFlash: 0,
    superFlash: 0,
    attackLunge: 0,
    ultFlash: 0,
  };
}

export function createBattle(
  playerUnits: UnitInstance[],
  enemyUnits: UnitInstance[],
  seed: number,
): BattleState {
  const units = [...playerUnits, ...enemyUnits]
    .filter((u) => u.position)
    .map(toBattleUnit);
  return { units, elapsed: 0, finished: false, winner: null, rng: makeRng(seed) };
}

function dist(a: BattleUnit, b: BattleUnit): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function findTarget(unit: BattleUnit, units: BattleUnit[]): BattleUnit | null {
  let best: BattleUnit | null = null;
  let bestScore = Infinity;
  for (const other of units) {
    if (!other.alive || other.owner === unit.owner) continue;
    // primary: distance, tie-break: lower hp
    const score = dist(unit, other) + other.hp / 10000;
    if (score < bestScore) {
      bestScore = score;
      best = other;
    }
  }
  return best;
}

function applyDamage(target: BattleUnit, amount: number): void {
  target.hp -= amount;
  target.hitFlash = 4;
  if (target.hp <= 0) {
    target.hp = 0;
    target.alive = false;
  }
}

function computeHit(attacker: BattleUnit, target: BattleUnit, rng: () => number): number {
  const typeMult = getTypeMultiplier(attacker.type, target.type);
  let dmg = Math.max(1, attacker.atk * typeMult - target.def);
  if (rng() < CRIT_CHANCE) dmg *= CRIT_MULT;
  if (typeMult > 1) target.superFlash = 5; // super-effective visual
  return Math.round(dmg);
}

/** Ultimate effect: an empowered strike scaling with the unit's tier, with splash for ranged units. */
function castUltimate(attacker: BattleUnit, target: BattleUnit, units: BattleUnit[]): void {
  attacker.ultFlash = 8;
  const bonus = Math.round(attacker.atk * (0.8 + Math.min(attacker.tier, 8) * 0.12));
  applyDamage(target, bonus);
  if (attacker.range >= 2) {
    // splash to nearby enemies
    for (const other of units) {
      if (!other.alive || other.owner === attacker.owner || other.id === target.id) continue;
      if (dist(target, other) <= 1.6) {
        applyDamage(other, Math.round(bonus * 0.5));
      }
    }
  }
}

/** Advances the simulation by one tick. Mutates and returns the state. */
export function stepBattle(state: BattleState): BattleState {
  if (state.finished) return state;
  state.elapsed += TICK_DT;

  for (const unit of state.units) {
    if (!unit.alive) continue;
    if (unit.hitFlash > 0) unit.hitFlash--;
    if (unit.superFlash > 0) unit.superFlash--;
    if (unit.attackLunge > 0) unit.attackLunge--;
    if (unit.ultFlash > 0) unit.ultFlash--;
    if (unit.cooldown > 0) unit.cooldown -= TICK_DT;

    // (Re)acquire target if needed.
    let target = unit.targetId ? state.units.find((u) => u.id === unit.targetId) : null;
    if (!target || !target.alive) {
      target = findTarget(unit, state.units);
      unit.targetId = target?.id ?? null;
    }
    if (!target) continue;

    const d = dist(unit, target);
    const inRange = d <= unit.range + 0.05;

    if (inRange) {
      if (unit.cooldown <= 0) {
        // attack
        unit.attackLunge = 3;
        unit.cooldown = 1 / unit.spd;
        const dmg = computeHit(unit, target, state.rng);
        applyDamage(target, dmg);
        unit.mana = Math.min(MANA_MAX, unit.mana + MANA_PER_ATTACK);
        if (unit.mana >= MANA_MAX && target.alive) {
          unit.mana = 0;
          castUltimate(unit, target, state.units);
        }
      }
    } else {
      // move toward target
      const step = MOVE_SPEED * TICK_DT;
      const nx = target.x - unit.x;
      const ny = target.y - unit.y;
      const len = Math.hypot(nx, ny) || 1;
      unit.x += (nx / len) * Math.min(step, d);
      unit.y += (ny / len) * Math.min(step, d);
    }
  }

  evaluateEnd(state);
  return state;
}

function evaluateEnd(state: BattleState): void {
  const playerAlive = state.units.some((u) => u.owner === 'player' && u.alive);
  const enemyAlive = state.units.some((u) => u.owner === 'enemy' && u.alive);

  if (!playerAlive || !enemyAlive) {
    state.finished = true;
    state.winner = playerAlive ? 'player' : enemyAlive ? 'enemy' : null;
    return;
  }

  if (state.elapsed >= MAX_BATTLE_SECONDS) {
    state.finished = true;
    state.winner = decideByRemainingHp(state);
  }
}

function decideByRemainingHp(state: BattleState): Owner {
  const frac = (owner: Owner): number => {
    let cur = 0;
    let max = 0;
    for (const u of state.units) {
      if (u.owner !== owner) continue;
      cur += u.hp;
      max += u.maxHp;
    }
    return max > 0 ? cur / max : 0;
  };
  return frac('player') >= frac('enemy') ? 'player' : 'enemy';
}

/** Runs a battle head-less to completion. Used for balance testing. */
export function simulateToEnd(
  playerUnits: UnitInstance[],
  enemyUnits: UnitInstance[],
  seed: number,
): Owner | null {
  const state = createBattle(playerUnits, enemyUnits, seed);
  let guard = 0;
  while (!state.finished && guard++ < MAX_BATTLE_SECONDS * TICK_RATE + 10) {
    stepBattle(state);
  }
  return state.winner;
}
