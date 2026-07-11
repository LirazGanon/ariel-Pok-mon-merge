import { create } from 'zustand';
import type {
  BoardPosition,
  Finish,
  GamePhase,
  Owner,
  PlayerSaveState,
  ShopOffer,
  UnitInstance,
  WheelPrize,
} from '../types';
import { POKEDEX, getSpecies, getNextSpecies, speciesAtTier, LADDER_LENGTH } from '../data/pokedex';
import { costForSpecies, sellValue } from '../game/stats';
import { getStageConfig } from '../game/stage';
import { computePower, computeEnemyBudget, generateEnemyArmy } from '../game/ai';
import { computeWinGold, computeLossGold } from '../game/economy';
import { spinWheel } from '../game/wheel';
import { rollFinish, betterFinish } from '../game/finish';
import { makeRng, weightedPick, randInt } from '../game/rng';
import { BENCH_SIZE, PLAYER_ROWS, SCHEMA_VERSION } from '../game/constants';

const SAVE_KEY = 'ariel-pokemon-save-v2';
const REROLL_COST = 1;

function genId(): string {
  return (crypto as Crypto & { randomUUID?: () => string }).randomUUID?.() ??
    `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultSave(): PlayerSaveState {
  return {
    schemaVersion: SCHEMA_VERSION,
    gold: 10,
    currentStage: 1,
    bench: [],
    board: [],
    winStreak: 0,
    lossStreakAtStage: 0,
    wheelPityCounter: 0,
    unlockedSpecies: [],
  };
}

function loadSave(): PlayerSaveState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlayerSaveState;
    if (parsed.schemaVersion !== SCHEMA_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persist(state: PlayerSaveState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    /* storage may be unavailable */
  }
}

/**
 * Repeatedly merges any two player units of the SAME species into one unit of
 * the next rung on the ladder (a different, stronger Pokémon). Deterministic in
 * species, but a special "finish" on a parent has a 50% chance to carry over to
 * the evolution and 50% to be lost.
 */
function mergeAll(units: UnitInstance[]): UnitInstance[] {
  const result = units.map((u) => ({ ...u }));
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const a = result[i];
        const b = result[j];
        const next = getSpecies(a.speciesId).next;
        if (a.speciesId === b.speciesId && next) {
          // Keep whichever already sits on the board (preserve placement).
          const keep = a.position ? a : b.position ? b : a;
          const drop = keep === a ? b : a;
          keep.speciesId = next;
          // Finish inheritance: 50% keep the best parent finish, 50% lose it.
          const parentFinish = betterFinish(a.finish, b.finish);
          keep.finish = parentFinish && Math.random() < 0.5 ? parentFinish : null;
          result.splice(result.indexOf(drop), 1);
          merged = true;
          break outer;
        }
      }
    }
  }
  return result;
}

/**
 * Shop offers: 5 DISTINCT species you can rebuy freely. Weighted toward cheap
 * rungs and (heavily) toward species you can currently afford; expensive ones
 * you cannot afford yet only rarely appear. Each offer may roll a rare finish.
 */
function generateOffers(stageNumber: number, gold: number): ShopOffer[] {
  const stage = getStageConfig(stageNumber);
  const pool = POKEDEX.filter((s) => s.tier <= stage.shopMaxTier);
  const seed = (Date.now() ^ (stageNumber * 7919) ^ Math.floor(Math.random() * 1e9)) >>> 0;
  const rng = makeRng(seed);

  const available = [...pool];
  const offers: ShopOffer[] = [];
  const count = Math.min(5, available.length);
  for (let i = 0; i < count; i++) {
    const weights = available.map((c) => {
      const affordable = costForSpecies(c) <= gold;
      return 50 * Math.pow(0.55, c.tier - 1) * (affordable ? 1 : 0.1);
    });
    const s = weightedPick(rng, available, weights);
    available.splice(available.indexOf(s), 1); // keep species unique in the shop
    offers.push({ speciesId: s.id, finish: rollFinish(rng) });
  }
  return offers;
}

/**
 * Generates the enemy army for a stage, anchored to the CURRENT player army so
 * it scales as you build during prep (closes the "out-build the preview" gap).
 * The seed is deterministic per stage so the preview stays stable frame-to-frame.
 */
function buildStageEnemy(
  stageNumber: number,
  board: UnitInstance[],
  winStreak: number,
  lossStreakAtStage: number,
): { enemyArmy: UnitInstance[]; seed: number } {
  const stage = getStageConfig(stageNumber);
  const playerPower = computePower(board);
  const budget = computeEnemyBudget(stage, playerPower, { winStreak, lossStreakAtStage });
  const seed = ((stageNumber * 2654435761) ^ (lossStreakAtStage * 40503) ^ 0x5f3759df) >>> 0;
  return { enemyArmy: generateEnemyArmy(stage, budget, seed), seed };
}

interface GameStore extends PlayerSaveState {
  phase: GamePhase;
  offers: ShopOffer[];
  enemyArmy: UnitInstance[];
  battleSeed: number;
  lastResult: { winner: Owner; goldEarned: number } | null;
  lastWheelPrize: WheelPrize | null;

  // navigation
  goTo: (phase: GamePhase) => void;
  startNewGame: () => void;

  // shop
  reroll: () => void;
  buy: (offerIndex: number) => void;

  // board
  placeUnit: (instanceId: string, position: BoardPosition | null) => void;
  sellUnit: (instanceId: string) => void;

  // battle flow
  startBattle: () => void;
  finishBattle: (winner: Owner) => void;
  spin: () => void;
  proceedAfterWheel: () => void;
  retryStage: () => void;
}

function snapshot(s: GameStore): PlayerSaveState {
  return {
    schemaVersion: SCHEMA_VERSION,
    gold: s.gold,
    currentStage: s.currentStage,
    bench: s.bench,
    board: s.board,
    winStreak: s.winStreak,
    lossStreakAtStage: s.lossStreakAtStage,
    wheelPityCounter: s.wheelPityCounter,
    unlockedSpecies: s.unlockedSpecies,
  };
}

export const useGameStore = create<GameStore>((set, get) => {
  const initial = loadSave() ?? defaultSave();
  const { enemyArmy, seed } = buildStageEnemy(
    initial.currentStage,
    initial.board,
    initial.winStreak,
    initial.lossStreakAtStage,
  );

  return {
    ...initial,
    phase: 'splash',
    offers: generateOffers(initial.currentStage, initial.gold),
    enemyArmy,
    battleSeed: seed,
    lastResult: null,
    lastWheelPrize: null,

    goTo: (phase) => set({ phase }),

    startNewGame: () => {
      const fresh = defaultSave();
      const { enemyArmy: army, seed: sd } = buildStageEnemy(1, [], 0, 0);
      set({
        ...fresh,
        phase: 'prep',
        offers: generateOffers(1, fresh.gold),
        enemyArmy: army,
        battleSeed: sd,
        lastResult: null,
        lastWheelPrize: null,
      });
      persist(fresh);
    },

    reroll: () => {
      const s = get();
      if (s.gold < REROLL_COST) return;
      const gold = s.gold - REROLL_COST;
      set({ gold, offers: generateOffers(s.currentStage, gold) });
      persist(snapshot(get()));
    },

    buy: (offerIndex) => {
      const s = get();
      const offer = s.offers[offerIndex];
      if (!offer) return;
      const species = getSpecies(offer.speciesId);
      const cost = costForSpecies(species);
      if (s.gold < cost) return;
      if (s.bench.length >= BENCH_SIZE) return;

      const newUnit: UnitInstance = {
        instanceId: genId(),
        speciesId: offer.speciesId,
        finish: offer.finish,
        owner: 'player',
        position: null,
      };

      const combined = mergeAll([...s.board, ...s.bench, newUnit]);
      // The offer stays in the shop — you can rebuy it freely while you have gold.
      const unlocked = s.unlockedSpecies.includes(offer.speciesId)
        ? s.unlockedSpecies
        : [...s.unlockedSpecies, offer.speciesId];

      const board = combined.filter((u) => u.position);
      const en = buildStageEnemy(s.currentStage, board, s.winStreak, s.lossStreakAtStage);
      set({
        gold: s.gold - cost,
        board,
        bench: combined.filter((u) => !u.position),
        unlockedSpecies: unlocked,
        enemyArmy: en.enemyArmy,
        battleSeed: en.seed,
      });
      persist(snapshot(get()));
    },

    placeUnit: (instanceId, position) => {
      const s = get();
      const stage = getStageConfig(s.currentStage);
      const all = [...s.board, ...s.bench];
      const unit = all.find((u) => u.instanceId === instanceId);
      if (!unit) return;

      // Enforce player area only.
      if (position && !PLAYER_ROWS.includes(position.row as (typeof PLAYER_ROWS)[number])) return;

      // Enforce unit cap when moving from bench to board.
      const boardCount = s.board.filter((u) => u.instanceId !== instanceId).length;
      if (position && !unit.position && boardCount >= stage.unitCap) return;

      // If target cell occupied by another player unit, swap or merge.
      const occupant = position
        ? s.board.find(
            (u) =>
              u.instanceId !== instanceId &&
              u.position &&
              u.position.row === position.row &&
              u.position.col === position.col,
          )
        : undefined;

      const updated = all.map((u) => ({ ...u }));
      const target = updated.find((u) => u.instanceId === instanceId)!;
      const prevPos = unit.position;

      if (occupant) {
        const occ = updated.find((u) => u.instanceId === occupant.instanceId)!;
        // swap positions (merge handled afterwards by mergeAll)
        occ.position = prevPos;
        target.position = position;
      } else {
        target.position = position;
      }

      // Enforce cap again after potential board additions.
      const merged = mergeAll(updated);
      const boardAfter = merged.filter((u) => u.position);
      if (boardAfter.length > stage.unitCap) return;

      const en = buildStageEnemy(s.currentStage, boardAfter, s.winStreak, s.lossStreakAtStage);
      set({
        board: boardAfter,
        bench: merged.filter((u) => !u.position),
        enemyArmy: en.enemyArmy,
        battleSeed: en.seed,
      });
      persist(snapshot(get()));
    },

    sellUnit: (instanceId) => {
      const s = get();
      const all = [...s.board, ...s.bench];
      const unit = all.find((u) => u.instanceId === instanceId);
      if (!unit) return;
      const refund = sellValue(getSpecies(unit.speciesId));
      const remaining = all.filter((u) => u.instanceId !== instanceId);
      const board = remaining.filter((u) => u.position);
      const en = buildStageEnemy(s.currentStage, board, s.winStreak, s.lossStreakAtStage);
      set({
        gold: s.gold + refund,
        board,
        bench: remaining.filter((u) => !u.position),
        enemyArmy: en.enemyArmy,
        battleSeed: en.seed,
      });
      persist(snapshot(get()));
    },

    startBattle: () => {
      const s = get();
      if (s.board.length === 0) return;
      set({ phase: 'battle' });
    },

    finishBattle: (winner) => {
      const s = get();
      let goldEarned: number;
      let winStreak = s.winStreak;
      let lossStreakAtStage = s.lossStreakAtStage;

      if (winner === 'player') {
        goldEarned = computeWinGold(s.currentStage, s.winStreak, s.gold);
        winStreak = s.winStreak + 1;
        lossStreakAtStage = 0;
      } else {
        goldEarned = computeLossGold(s.currentStage);
        winStreak = 0;
        lossStreakAtStage = s.lossStreakAtStage + 1;
      }

      set({
        gold: s.gold + goldEarned,
        winStreak,
        lossStreakAtStage,
        lastResult: { winner, goldEarned },
        phase: 'result',
      });
      persist(snapshot(get()));
    },

    spin: () => {
      const s = get();
      const rng = makeRng((Date.now() ^ (s.wheelPityCounter * 40503)) >>> 0);
      const result = spinWheel(s.wheelPityCounter, rng);
      applyWheelPrize(set, get, result.prize);
      set({ wheelPityCounter: result.newPityCounter, lastWheelPrize: result.prize });
      persist(snapshot(get()));
    },

    proceedAfterWheel: () => {
      const s = get();
      const nextStage = s.currentStage + 1;
      const { enemyArmy: army, seed: sd } = buildStageEnemy(nextStage, s.board, s.winStreak, 0);
      set({
        currentStage: nextStage,
        offers: generateOffers(nextStage, s.gold),
        enemyArmy: army,
        battleSeed: sd,
        lastResult: null,
        lastWheelPrize: null,
        phase: 'prep',
      });
      persist(snapshot(get()));
    },

    retryStage: () => {
      const s = get();
      const { enemyArmy: army, seed: sd } = buildStageEnemy(
        s.currentStage,
        s.board,
        s.winStreak,
        s.lossStreakAtStage,
      );
      set({
        offers: generateOffers(s.currentStage, s.gold),
        enemyArmy: army,
        battleSeed: sd,
        lastResult: null,
        phase: 'prep',
      });
      persist(snapshot(get()));
    },
  };
});

function applyWheelPrize(
  set: (partial: Partial<GameStore>) => void,
  get: () => GameStore,
  prize: WheelPrize,
): void {
  const s = get();
  const rng = makeRng((Date.now() ^ 0x9e3779b9) >>> 0);
  const stage = getStageConfig(s.currentStage);

  const addUnitAtTier = (tier: number, finish: Finish | null = null) => {
    const clamped = Math.max(1, Math.min(LADDER_LENGTH, tier));
    const species = speciesAtTier(clamped);
    if (!species || s.bench.length >= BENCH_SIZE) {
      set({ gold: s.gold + 20 });
      return;
    }
    const unit: UnitInstance = {
      instanceId: genId(),
      speciesId: species.id,
      finish,
      owner: 'player',
      position: null,
    };
    const combined = mergeAll([...s.board, ...s.bench, unit]);
    set({
      board: combined.filter((u) => u.position),
      bench: combined.filter((u) => !u.position),
      unlockedSpecies: s.unlockedSpecies.includes(species.id)
        ? s.unlockedSpecies
        : [...s.unlockedSpecies, species.id],
    });
  };

  switch (prize.kind) {
    case 'goldSmall':
      set({ gold: s.gold + randInt(rng, 8, 16) });
      break;
    case 'goldMedium':
      set({ gold: s.gold + randInt(rng, 20, 35) });
      break;
    case 'evolveStone': {
      // Instantly evolve the highest-tier upgradable unit (a free merge).
      const all = [...s.board, ...s.bench].map((u) => ({ ...u }));
      const upgradable = all
        .filter((u) => getNextSpecies(u.speciesId) !== null)
        .sort((a, b) => getSpecies(b.speciesId).tier - getSpecies(a.speciesId).tier);
      if (upgradable.length > 0) {
        const targetId = upgradable[0].instanceId;
        const bumped = all.map((u) =>
          u.instanceId === targetId ? { ...u, speciesId: getSpecies(u.speciesId).next! } : u,
        );
        const merged = mergeAll(bumped);
        set({
          board: merged.filter((u) => u.position),
          bench: merged.filter((u) => !u.position),
        });
      } else {
        set({ gold: s.gold + 20 });
      }
      break;
    }
    case 'tier2Unit':
      addUnitAtTier(Math.max(2, stage.shopMaxTier - 1));
      break;
    case 'tier3Unit':
      addUnitAtTier(stage.shopMaxTier + 1, 'shiny');
      break;
    case 'jackpot':
      addUnitAtTier(stage.shopMaxTier + 3, 'gold');
      break;
  }
}
