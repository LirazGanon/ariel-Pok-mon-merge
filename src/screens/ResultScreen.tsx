import { useGameStore } from '../store/gameStore';

export default function ResultScreen() {
  const lastResult = useGameStore((s) => s.lastResult);
  const goTo = useGameStore((s) => s.goTo);
  const retryStage = useGameStore((s) => s.retryStage);
  const currentStage = useGameStore((s) => s.currentStage);

  if (!lastResult) return null;
  const won = lastResult.winner === 'player';

  return (
    <div className={'result ' + (won ? 'result-win' : 'result-lose')}>
      <div className="result-card">
        <h1 className="result-title">{won ? '🏆 ניצחון!' : '💀 הפסד'}</h1>
        <p className="result-sub">
          {won ? `סיימת את שלב ${currentStage}` : `שלב ${currentStage} — נסה שוב`}
        </p>
        <div className="result-reward">
          <span>💰 +{lastResult.goldEarned}</span>
          <small>{won ? 'תגמול ניצחון' : 'תגמול ניחומים'}</small>
        </div>
        {won ? (
          <button className="btn btn-primary" onClick={() => goTo('wheel')}>
            🎡 סובב את גלגל המזל
          </button>
        ) : (
          <button className="btn btn-primary" onClick={retryStage}>
            🔁 נסה שוב
          </button>
        )}
      </div>
    </div>
  );
}
