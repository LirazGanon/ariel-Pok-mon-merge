import { useMemo, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import PokemonSprite from '../components/PokemonSprite';
import { getSpecies, getNextSpecies } from '../data/pokedex';
import { costForSpecies, computeStats } from '../game/stats';
import { getStageConfig } from '../game/stage';
import { computePower } from '../game/ai';
import { TYPE_META } from '../data/typeChart';
import { FINISH_META } from '../game/finish';
import { BOARD_COLS, BOARD_ROWS, ENEMY_ROWS, PLAYER_ROWS } from '../game/constants';
import type { UnitInstance } from '../types';

export default function PrepScreen() {
  const s = useGameStore();
  const [selected, setSelected] = useState<string | null>(null);

  const stage = getStageConfig(s.currentStage);
  const playerPower = useMemo(() => computePower(s.board), [s.board]);
  const enemyPower = useMemo(() => computePower(s.enemyArmy), [s.enemyArmy]);

  const boardMap = useMemo(() => {
    const m = new Map<string, UnitInstance>();
    s.board.forEach((u) => u.position && m.set(`${u.position.row}-${u.position.col}`, u));
    return m;
  }, [s.board]);

  const enemyMap = useMemo(() => {
    const m = new Map<string, UnitInstance>();
    s.enemyArmy.forEach((u) => u.position && m.set(`${u.position.row}-${u.position.col}`, u));
    return m;
  }, [s.enemyArmy]);

  const selectedUnit =
    selected != null
      ? [...s.board, ...s.bench].find((u) => u.instanceId === selected) ?? null
      : null;

  function handleCellTap(row: number, col: number) {
    const isPlayerRow = (PLAYER_ROWS as readonly number[]).includes(row);
    const occupant = boardMap.get(`${row}-${col}`);
    if (!isPlayerRow) return;

    if (selected) {
      s.placeUnit(selected, { row, col });
      setSelected(null);
    } else if (occupant) {
      setSelected(occupant.instanceId);
    }
  }

  function handleBenchTap(instanceId: string) {
    setSelected((prev) => (prev === instanceId ? null : instanceId));
  }

  const powerRatio = playerPower > 0 ? enemyPower / playerPower : 2;

  return (
    <div className="prep">
      <header className="hud">
        <div className="hud-item">
          <span className="hud-label">שלב</span>
          <span className="hud-value">{s.currentStage}{stage.isBossStage ? ' 👑' : ''}</span>
        </div>
        <div className="hud-item gold">
          <span className="hud-label">💰 מטבעות</span>
          <span className="hud-value">{s.gold}</span>
        </div>
        <div className="hud-item">
          <span className="hud-label">יחידות</span>
          <span className="hud-value">
            {s.board.length}/{stage.unitCap}
          </span>
        </div>
        <div className="hud-item">
          <span className="hud-label">רצף</span>
          <span className="hud-value">🔥 {s.winStreak}</span>
        </div>
      </header>

      <div className="power-bar">
        <span>💪 {Math.round(playerPower)}</span>
        <div className="power-track">
          <div
            className="power-fill"
            style={{
              width: `${Math.min(100, powerRatio <= 1 ? 100 : 100 / powerRatio)}%`,
              background: powerRatio > 1.15 ? '#e53935' : powerRatio > 0.9 ? '#fb8c00' : '#43a047',
            }}
          />
        </div>
        <span>👹 {Math.round(enemyPower)}</span>
      </div>

      <div className="board-area">
        <div
          className="board"
          style={{
            gridTemplateColumns: `repeat(${BOARD_COLS}, 1fr)`,
            gridTemplateRows: `repeat(${BOARD_ROWS}, 1fr)`,
          }}
        >
          {Array.from({ length: BOARD_ROWS }).map((_, row) =>
            Array.from({ length: BOARD_COLS }).map((__, col) => {
              const isEnemy = (ENEMY_ROWS as readonly number[]).includes(row);
              const isPlayerRow = (PLAYER_ROWS as readonly number[]).includes(row);
              const occupant = boardMap.get(`${row}-${col}`);
              const enemy = isEnemy ? enemyMap.get(`${row}-${col}`) : undefined;
              const isSelectedCell = occupant && occupant.instanceId === selected;
              return (
                <button
                  key={`${row}-${col}`}
                  className={
                    'cell' +
                    (isEnemy ? ' cell-enemy' : '') +
                    (isPlayerRow ? ' cell-player' : '') +
                    (selected && isPlayerRow && !occupant ? ' cell-droppable' : '') +
                    (isSelectedCell ? ' cell-selected' : '')
                  }
                  onClick={() => handleCellTap(row, col)}
                >
                  {occupant && <PokemonSprite speciesId={occupant.speciesId} finish={occupant.finish} size={40} />}
                  {enemy && (
                    <div className="enemy-mini">
                      <PokemonSprite speciesId={enemy.speciesId} finish={enemy.finish} size={38} showType={false} />
                    </div>
                  )}
                </button>
              );
            }),
          )}
          <div className="board-divider" />
          {s.board.length === 0 && (
            <div className="board-hint">בחר פוקימון מהחנות והנח כאן ⬇️</div>
          )}
        </div>
      </div>

      {selectedUnit && (() => {
        const sp = getSpecies(selectedUnit.speciesId);
        const st = computeStats(sp, selectedUnit.finish);
        const next = getNextSpecies(selectedUnit.speciesId);
        const meta = TYPE_META[sp.type];
        const fin = selectedUnit.finish ? FINISH_META[selectedUnit.finish] : null;
        return (
          <div className="selected-bar">
            <PokemonSprite speciesId={selectedUnit.speciesId} finish={selectedUnit.finish} size={44} />
            <div className="selected-info">
              <strong>
                {sp.displayName}{' '}
                <span className="type-chip" style={{ background: meta.color }}>
                  {meta.emoji} {meta.label}
                </span>
                {fin && <span className="type-chip finish-chip"> {fin.emoji} {fin.label}</span>}
              </strong>
              <span className="unit-stats">
                ❤️{st.maxHp} ⚔️{st.atk} 🛡️{st.def}
                {next && <span className="evo-hint"> · 2 → {next.displayName}</span>}
              </span>
            </div>
            {selectedUnit.position && (
              <button
                className="btn btn-small"
                onClick={() => {
                  s.placeUnit(selectedUnit.instanceId, null);
                  setSelected(null);
                }}
              >
                לספסל
              </button>
            )}
            <button
              className="btn btn-small btn-danger"
              onClick={() => {
                s.sellUnit(selectedUnit.instanceId);
                setSelected(null);
              }}
            >
              מכור
            </button>
          </div>
        );
      })()}

      <div className="bench">
        <span className="bench-label">ספסל</span>
        <div className="bench-slots">
          {s.bench.map((u) => (
            <button
              key={u.instanceId}
              className={'bench-slot' + (u.instanceId === selected ? ' bench-selected' : '')}
              onClick={() => handleBenchTap(u.instanceId)}
            >
              <PokemonSprite speciesId={u.speciesId} finish={u.finish} size={44} />
            </button>
          ))}
          {s.bench.length === 0 && <span className="bench-empty">קנה פוקימונים מהחנות</span>}
        </div>
      </div>

      <div className="shop">
        <div className="shop-header">
          <span>🛒 חנות</span>
          <button className="btn btn-small" onClick={s.reroll} disabled={s.gold < 1}>
            🔄 רענון 💰-1
          </button>
        </div>
        <div className="shop-cards">
          {s.offers.map((offer, i) => {
            const sp = getSpecies(offer.speciesId);
            const cost = costForSpecies(sp);
            const affordable = s.gold >= cost && s.bench.length < 8;
            const meta = TYPE_META[sp.type];
            return (
              <button
                key={i}
                className={'shop-card' + (affordable ? '' : ' disabled')}
                style={{ borderColor: meta.color }}
                onClick={() => affordable && s.buy(i)}
                disabled={!affordable}
              >
                <PokemonSprite speciesId={offer.speciesId} finish={offer.finish} size={48} />
                <span className="shop-name">{sp.displayName}</span>
                <span className="shop-cost">💰 {cost}</span>
              </button>
            );
          })}
        </div>
      </div>

      <button className="btn btn-play" onClick={s.startBattle} disabled={s.board.length === 0}>
        ⚔️ שחק
      </button>
    </div>
  );
}
