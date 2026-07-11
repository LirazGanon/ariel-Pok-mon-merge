import { useMemo, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { WHEEL_PRIZES } from '../game/wheel';

const SEG = 360 / WHEEL_PRIZES.length;

export default function WheelScreen() {
  const spin = useGameStore((s) => s.spin);
  const proceed = useGameStore((s) => s.proceedAfterWheel);
  const lastWheelPrize = useGameStore((s) => s.lastWheelPrize);

  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [hasSpun, setHasSpun] = useState(false);

  const gradient = useMemo(() => {
    const stops = WHEEL_PRIZES.map((p, i) => `${p.color} ${i * SEG}deg ${(i + 1) * SEG}deg`);
    return `conic-gradient(${stops.join(', ')})`;
  }, []);

  function handleSpin() {
    if (spinning || hasSpun) return;
    setSpinning(true);
    setHasSpun(true);
    spin();
    const prize = useGameStore.getState().lastWheelPrize!;
    const index = WHEEL_PRIZES.findIndex((p) => p.kind === prize.kind);
    const target = 360 * 5 - (index * SEG + SEG / 2);
    setRotation(target);
    window.setTimeout(() => {
      setSpinning(false);
      setRevealed(true);
    }, 4200);
  }

  return (
    <div className="wheel-screen">
      <h1 className="wheel-heading">🎡 גלגל המזל</h1>
      <div className="wheel-wrap">
        <div className="wheel-pointer">▼</div>
        <div
          className="wheel"
          style={{
            background: gradient,
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.24, 1)' : 'none',
          }}
        />
      </div>

      <div className="wheel-legend">
        {WHEEL_PRIZES.map((p) => (
          <span key={p.kind} className="legend-item">
            <i style={{ background: p.color }} />
            {p.label}
          </span>
        ))}
      </div>

      {!hasSpun && (
        <button className="btn btn-play" onClick={handleSpin}>
          סובב!
        </button>
      )}

      {revealed && lastWheelPrize && (
        <div className="wheel-reveal">
          <p>
            זכית: <strong style={{ color: lastWheelPrize.color }}>{lastWheelPrize.label}</strong>!
          </p>
          <button className="btn btn-primary" onClick={proceed}>
            המשך לשלב הבא ➡️
          </button>
        </div>
      )}
    </div>
  );
}
