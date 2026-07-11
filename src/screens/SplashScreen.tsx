import { useGameStore } from '../store/gameStore';
import mainImage from '../../main.png';

export default function SplashScreen() {
  const goTo = useGameStore((s) => s.goTo);
  const startNewGame = useGameStore((s) => s.startNewGame);
  const currentStage = useGameStore((s) => s.currentStage);
  const hasProgress = currentStage > 1 || useGameStore.getState().board.length > 0;

  return (
    <div className="splash">
      <img className="splash-bg" src={mainImage} alt="אריאל: משלב הפוקימונים" />
      <div className="splash-overlay">
        <h1 className="splash-title">אריאל</h1>
        <h2 className="splash-subtitle">משלב הפוקימונים</h2>
        <div className="splash-buttons">
          {hasProgress && (
            <button className="btn btn-primary" onClick={() => goTo('prep')}>
              המשך משחק · שלב {currentStage}
            </button>
          )}
          <button className="btn btn-secondary" onClick={startNewGame}>
            משחק חדש
          </button>
        </div>
        <p className="splash-hint">בנה צבא · מזג פוקימונים · נצח את היריב</p>
      </div>
    </div>
  );
}
