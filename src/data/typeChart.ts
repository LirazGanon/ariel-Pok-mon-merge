import type { PokemonType } from '../types';

/**
 * Simplified type-effectiveness chart. Only notable relationships are listed;
 * anything unlisted defaults to 1.0. Values: 2 = super effective, 0.5 = resisted.
 */
const CHART: Partial<Record<PokemonType, Partial<Record<PokemonType, number>>>> = {
  fire: { grass: 2, bug: 2, ice: 2, water: 0.5, rock: 0.5, fire: 0.5 },
  water: { fire: 2, rock: 2, grass: 0.5, water: 0.5, electric: 0.5 },
  grass: { water: 2, rock: 2, grass: 0.5, fire: 0.5, flying: 0.5, poison: 0.5, bug: 0.5 },
  electric: { water: 2, flying: 2, grass: 0.5, electric: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5 },
  fighting: { normal: 2, rock: 2, ice: 2, flying: 0.5, psychic: 0.5, bug: 0.5, ghost: 0 },
  poison: { grass: 2, rock: 0.5, ghost: 0.5, poison: 0.5 },
  flying: { grass: 2, fighting: 2, bug: 2, electric: 0.5, rock: 0.5 },
  rock: { fire: 2, ice: 2, flying: 2, bug: 2, fighting: 0.5 },
  bug: { grass: 2, psychic: 2, fire: 0.5, fighting: 0.5, flying: 0.5 },
  ghost: { psychic: 2, ghost: 2, normal: 0, },
  ice: { grass: 2, flying: 2, rock: 0.5, water: 0.5, fire: 0.5, ice: 0.5 },
  normal: { rock: 0.5, ghost: 0 },
};

export function getTypeMultiplier(attacker: PokemonType, defender: PokemonType): number {
  return CHART[attacker]?.[defender] ?? 1;
}

export interface TypeMeta {
  color: string;
  emoji: string;
  label: string; // Hebrew
}

export const TYPE_META: Record<PokemonType, TypeMeta> = {
  normal: { color: '#9099a1', emoji: '⭐', label: 'רגיל' },
  fire: { color: '#ff6b3d', emoji: '🔥', label: 'אש' },
  water: { color: '#3d9bff', emoji: '💧', label: 'מים' },
  grass: { color: '#5cc15c', emoji: '🌿', label: 'עשב' },
  electric: { color: '#ffd23d', emoji: '⚡', label: 'חשמל' },
  psychic: { color: '#ff5da0', emoji: '🔮', label: 'על-חושי' },
  poison: { color: '#a95cc1', emoji: '☠️', label: 'רעל' },
  flying: { color: '#8fb6ff', emoji: '🪽', label: 'מעופף' },
  rock: { color: '#c1a15c', emoji: '🪨', label: 'סלע' },
  fighting: { color: '#e0533d', emoji: '🥊', label: 'לחימה' },
  bug: { color: '#9bbf3d', emoji: '🐛', label: 'חרק' },
  ghost: { color: '#7b5cc1', emoji: '👻', label: 'רוח' },
  ice: { color: '#7fe0e0', emoji: '❄️', label: 'קרח' },
};
