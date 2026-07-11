import type { Finish, PokemonSpecies } from '../types';
import { LADDER_GROWTH } from '../data/pokedex';
import { finishMultiplier } from './finish';

export interface ComputedStats {
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  range: number;
}

/** A unit is defined by its species (rung) and an optional finish (power boost). */
export function computeStats(species: PokemonSpecies, finish?: Finish | null): ComputedStats {
  const m = finishMultiplier(finish);
  return {
    maxHp: Math.round(species.stats.hp * m),
    atk: Math.round(species.stats.atk * m),
    def: Math.round(species.stats.def * m),
    spd: species.stats.spd,
    range: species.stats.range,
  };
}

/** Abstract power score of a unit, used by the economy and the AI budget. */
export function unitPower(species: PokemonSpecies, finish?: Finish | null): number {
  return 10 * Math.pow(LADDER_GROWTH, species.tier - 1) * finishMultiplier(finish);
}

/** Shop cost of a species. Doubles every rung, so buying a rung-(n+1) costs the
 *  same as buying two rung-n and merging them — higher tiers are far pricier. */
export function costForTier(tier: number): number {
  return Math.round(3 * Math.pow(2, tier - 1));
}

export function costForSpecies(species: PokemonSpecies): number {
  return costForTier(species.tier);
}

/** Gold returned when selling a unit (a fraction of its buy cost). */
export function sellValue(species: PokemonSpecies): number {
  return Math.max(1, Math.round(costForSpecies(species) * 0.6));
}
