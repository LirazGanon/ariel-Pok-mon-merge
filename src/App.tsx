import { useGameStore } from './store/gameStore';
import SplashScreen from './screens/SplashScreen';
import PrepScreen from './screens/PrepScreen';
import BattleScreen from './screens/BattleScreen';
import ResultScreen from './screens/ResultScreen';
import WheelScreen from './screens/WheelScreen';

export default function App() {
  const phase = useGameStore((s) => s.phase);

  return (
    <div className="app-shell">
      {phase === 'splash' && <SplashScreen />}
      {phase === 'prep' && <PrepScreen />}
      {phase === 'battle' && <BattleScreen />}
      {phase === 'result' && <ResultScreen />}
      {phase === 'wheel' && <WheelScreen />}
    </div>
  );
}
