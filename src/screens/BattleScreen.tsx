import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { createBattle, stepBattle, TICK_DT, type BattleState, type BattleUnit } from '../game/battle';
import { BOARD_COLS, BOARD_ROWS } from '../game/constants';
import { getSpecies, spriteUrl, remoteSpriteUrl } from '../data/pokedex';
import { FINISH_META } from '../game/finish';

const SPEEDS = [1, 2, 3] as const;

export default function BattleScreen() {
  const board = useGameStore((s) => s.board);
  const enemyArmy = useGameStore((s) => s.enemyArmy);
  const battleSeed = useGameStore((s) => s.battleSeed);
  const finishBattle = useGameStore((s) => s.finishBattle);

  const stateRef = useRef<BattleState | null>(null);
  const [, forceRender] = useState(0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const [ended, setEnded] = useState<null | 'player' | 'enemy'>(null);

  // Initialise the battle once.
  if (stateRef.current === null) {
    stateRef.current = createBattle(board, enemyArmy, battleSeed);
  }

  useEffect(() => {
    let raf = 0;
    let acc = 0;
    let last = performance.now();
    let finishedHandled = false;

    const loop = (now: number) => {
      const state = stateRef.current!;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      acc += dt * speedRef.current;
      while (acc >= TICK_DT && !state.finished) {
        stepBattle(state);
        acc -= TICK_DT;
      }
      forceRender((n) => n + 1);

      if (state.finished && !finishedHandled) {
        finishedHandled = true;
        setEnded(state.winner);
        window.setTimeout(() => finishBattle(state.winner ?? 'enemy'), 1600);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [finishBattle]);

  const state = stateRef.current!;

  return (
    <div className="battle">
      <div className="battle-topbar">
        <span>⚔️ קרב!</span>
        <div className="speed-controls">
          {SPEEDS.map((sp) => (
            <button
              key={sp}
              className={'btn btn-small' + (speed === sp ? ' active' : '')}
              onClick={() => setSpeed(sp)}
            >
              ×{sp}
            </button>
          ))}
        </div>
      </div>

      <div
        className="battle-field"
        style={{ aspectRatio: `${BOARD_COLS} / ${BOARD_ROWS}` }}
      >
        {state.units
          .filter((u) => u.alive)
          .map((u) => (
            <BattleUnitView key={u.id} unit={u} />
          ))}
      </div>

      {ended && (
        <div className={'battle-result-banner ' + (ended === 'player' ? 'win' : 'lose')}>
          {ended === 'player' ? '🏆 ניצחון!' : '💀 הפסד'}
        </div>
      )}
    </div>
  );
}

function BattleUnitView({ unit }: { unit: BattleUnit }) {
  const left = ((unit.x + 0.5) / BOARD_COLS) * 100;
  const top = ((unit.y + 0.5) / BOARD_ROWS) * 100;
  const hpFrac = Math.max(0, unit.hp / unit.maxHp);
  const species = getSpecies(unit.speciesId);

  return (
    <div
      className={
        'battle-unit ' +
        unit.owner +
        (unit.hitFlash > 0 ? ' hit' : '') +
        (unit.superFlash > 0 ? ' super' : '') +
        (unit.attackLunge > 0 ? ' lunge' : '') +
        (unit.ultFlash > 0 ? ' ult' : '')
      }
      style={{ left: `${left}%`, top: `${top}%` }}
    >
      <div className="bu-hpbar">
        <div
          className="bu-hpfill"
          style={{
            width: `${hpFrac * 100}%`,
            background: unit.owner === 'player' ? '#43a047' : '#e53935',
          }}
        />
      </div>
      <img
        className={'bu-sprite' + (unit.finish ? ' ' + FINISH_META[unit.finish].cls : '')}
        src={spriteUrl(species.dexId)}
        alt={species.displayName}
        draggable={false}
        onError={(e) => {
          const img = e.currentTarget as HTMLImageElement;
          if (!img.dataset.remote) {
            img.dataset.remote = '1';
            img.src = remoteSpriteUrl(species.dexId);
          } else {
            img.style.visibility = 'hidden';
          }
        }}
      />
      {unit.finish && <span className="bu-finish">{FINISH_META[unit.finish].emoji}</span>}
      {unit.superFlash > 0 && <span className="bu-super">!</span>}
    </div>
  );
}
