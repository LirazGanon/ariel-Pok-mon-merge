import type { BaseStats, PokemonSpecies, PokemonType } from '../types';

/**
 * Single, deterministic global merge ladder. From the base Pokémon you always
 * climb the SAME fixed path: two identical units merge into exactly one unit of
 * the next rung. Each rung is a different, stronger Pokémon with its own type,
 * so climbing changes your type coverage and the type-chart (§typeChart) drives
 * real rock-paper-scissors combat on top of raw power.
 *
 * Stats are generated from the rung index and a combat "role", so the ladder is
 * easy to extend and stays smoothly balanced.
 */

type Role = 'assassin' | 'bruiser' | 'tank' | 'ranged' | 'sniper';

interface RoleProfile {
  hpM: number;
  atkM: number;
  defM: number;
  spd: number;
  range: number;
}

const ROLES: Record<Role, RoleProfile> = {
  assassin: { hpM: 0.75, atkM: 1.5, defM: 0.6, spd: 1.2, range: 1 },
  bruiser: { hpM: 1.1, atkM: 1.3, defM: 0.9, spd: 1.0, range: 1 },
  tank: { hpM: 1.8, atkM: 0.7, defM: 1.9, spd: 0.8, range: 1 },
  ranged: { hpM: 0.9, atkM: 1.15, defM: 0.7, spd: 1.0, range: 2 },
  sniper: { hpM: 0.7, atkM: 1.65, defM: 0.5, spd: 1.05, range: 3 },
};

/** Per-rung power growth. Tuned so a higher rung is strong but a good type
 *  matchup (×2) can still upset a one-rung gap. */
export const LADDER_GROWTH = 1.55;
const BASE_HP = 45;
const BASE_ATK = 9;
const BASE_DEF = 5;

interface LadderEntry {
  id: string;
  dexId: number;
  displayName: string;
  type: PokemonType;
  role: Role;
  ability: string;
  rangeOverride?: number;
}

/** The ordered ladder. Index + 1 = tier/rung. Types deliberately vary. */
const LADDER: LadderEntry[] = [
  { id: 'caterpie', dexId: 10, displayName: 'Caterpie', type: 'bug', role: 'assassin', ability: 'רשת דביקה — מאט אויב' },
  { id: 'pidgey', dexId: 16, displayName: 'Pidgey', type: 'flying', role: 'ranged', ability: 'משב רוח — הודף אויב' },
  { id: 'rattata', dexId: 19, displayName: 'Rattata', type: 'normal', role: 'bruiser', ability: 'נשיכת על — מתקפה כפולה' },
  { id: 'zubat', dexId: 41, displayName: 'Zubat', type: 'poison', role: 'assassin', ability: 'מוצץ חיים — מרפא בפגיעה' },
  { id: 'squirtle', dexId: 7, displayName: 'Squirtle', type: 'water', role: 'tank', ability: 'מגן שריון — ספיגת נזק' },
  { id: 'charmander', dexId: 4, displayName: 'Charmander', type: 'fire', role: 'bruiser', ability: 'להבה — כוויה מתמשכת' },
  { id: 'bulbasaur', dexId: 1, displayName: 'Bulbasaur', type: 'grass', role: 'ranged', ability: 'שוט קיסוס — נזק אזור' },
  { id: 'pikachu', dexId: 25, displayName: 'Pikachu', type: 'electric', role: 'sniper', ability: 'רעם — נזק שרשרת' },
  { id: 'machop', dexId: 66, displayName: 'Machop', type: 'fighting', role: 'bruiser', ability: 'אגרוף על — נזק ליחיד' },
  { id: 'onix', dexId: 95, displayName: 'Onix', type: 'rock', role: 'tank', ability: 'חומת אבן — ספיגה גבוהה' },
  { id: 'gengar', dexId: 94, displayName: 'Gengar', type: 'ghost', role: 'sniper', ability: 'כדור צל — מתעלם מהגנה' },
  { id: 'charizard', dexId: 6, displayName: 'Charizard', type: 'fire', role: 'bruiser', ability: 'ים אש — נזק אזור', rangeOverride: 2 },
  { id: 'blastoise', dexId: 9, displayName: 'Blastoise', type: 'water', role: 'tank', ability: 'תותח מים — הדף וניזק', rangeOverride: 2 },
  { id: 'mewtwo', dexId: 150, displayName: 'Mewtwo', type: 'psychic', role: 'sniper', ability: 'פסיסטרייק — נזק אדיר מרחוק' },
];

function statsFor(entry: LadderEntry, rung: number): BaseStats {
  const role = ROLES[entry.role];
  const g = Math.pow(LADDER_GROWTH, rung - 1);
  return {
    hp: Math.round(BASE_HP * role.hpM * g),
    atk: Math.round(BASE_ATK * role.atkM * g),
    def: Math.round(BASE_DEF * role.defM * g),
    spd: role.spd,
    range: entry.rangeOverride ?? role.range,
  };
}

export const POKEDEX: PokemonSpecies[] = LADDER.map((entry, i) => ({
  id: entry.id,
  dexId: entry.dexId,
  displayName: entry.displayName,
  type: entry.type,
  tier: i + 1,
  next: i + 1 < LADDER.length ? LADDER[i + 1].id : null,
  stats: statsFor(entry, i + 1),
  ability: entry.ability,
}));

export const LADDER_LENGTH = LADDER.length;

export const SPECIES_BY_ID: Record<string, PokemonSpecies> = Object.fromEntries(
  POKEDEX.map((s) => [s.id, s]),
);

export function getSpecies(id: string): PokemonSpecies {
  const s = SPECIES_BY_ID[id];
  if (!s) throw new Error(`Unknown species: ${id}`);
  return s;
}

export function getNextSpecies(id: string): PokemonSpecies | null {
  const next = getSpecies(id).next;
  return next ? getSpecies(next) : null;
}

/** Species at a given rung (1-based). */
export function speciesAtTier(tier: number): PokemonSpecies | undefined {
  return POKEDEX.find((s) => s.tier === tier);
}

/** Local sprite path (downloaded via `npm run fetch-sprites`), base-path aware. */
export function spriteUrl(dexId: number): string {
  return `${import.meta.env.BASE_URL}assets/pokemon/${dexId}.png`;
}

/** Remote fallback from the public PokeAPI sprites repository. */
export function remoteSpriteUrl(dexId: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${dexId}.png`;
}

