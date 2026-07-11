export type PokemonType =
  | 'normal'
  | 'fire'
  | 'water'
  | 'grass'
  | 'electric'
  | 'psychic'
  | 'poison'
  | 'flying'
  | 'rock'
  | 'fighting'
  | 'bug'
  | 'ghost'
  | 'ice';

export type Tier = number; // rung on the global merge ladder (1 = base)

export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  spd: number; // attacks per second base
  range: number; // 1 = melee, 2+ = ranged (grid cells)
}

export interface PokemonSpecies {
  id: string; // internal id, e.g. "charmander"
  dexId: number; // national dex number (for sprite url)
  displayName: string;
  type: PokemonType;
  tier: Tier; // rung on the ladder
  next: string | null; // species id that two of this merge into (deterministic)
  stats: BaseStats;
  ability: string; // short description of the ultimate
}

export type Owner = 'player' | 'enemy';

export type Finish = 'shiny' | 'gold' | 'diamond' | 'rainbow';

export interface BoardPosition {
  row: number;
  col: number;
}

export interface UnitInstance {
  instanceId: string;
  speciesId: string;
  owner: Owner;
  finish?: Finish | null; // special power finish (optional)
  position: BoardPosition | null; // null = on the bench
}

export interface ShopOffer {
  speciesId: string;
  finish: Finish | null;
}

export interface StageConfig {
  stageNumber: number;
  budget: number;
  shopMaxTier: Tier;
  enemyMaxTier: Tier;
  unitCap: number;
  isBossStage: boolean;
}

export type WheelPrizeKind =
  | 'goldSmall'
  | 'goldMedium'
  | 'evolveStone'
  | 'tier2Unit'
  | 'tier3Unit'
  | 'jackpot';

export interface WheelPrize {
  kind: WheelPrizeKind;
  label: string;
  weight: number;
  color: string;
}

export type GamePhase = 'splash' | 'prep' | 'battle' | 'result' | 'wheel';

export interface PlayerSaveState {
  schemaVersion: number;
  gold: number;
  currentStage: number;
  bench: UnitInstance[];
  board: UnitInstance[];
  winStreak: number;
  lossStreakAtStage: number;
  wheelPityCounter: number;
  unlockedSpecies: string[];
}
