import { useEffect, useState, type CSSProperties } from 'react';
import { StoreProvider, useStore } from './state/store';
import { Header } from './components/Header';
import { BattletechPanel } from './components/BattletechPanel';
import { AddCombatant } from './components/AddCombatant';
import { InitiativeList } from './components/InitiativeList';
import { DicePanel } from './components/DicePanel';

function Tracker() {
  const { system, next, previous, undo } = useStore();
  const [diceOpen, setDiceOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = Boolean(
        target?.closest('input, textarea, select, [contenteditable="true"]'),
      );

      if (event.key === 'Escape') {
        setDiceOpen(false);
        if (typing) (target as HTMLElement).blur();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        if (typing) return;
        event.preventDefault();
        undo();
        return;
      }

      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;

      switch (event.key.toLowerCase()) {
        case 'n':
          event.preventDefault();
          next();
          break;
        case 'p':
          if (system.id !== 'shadowrun' && system.id !== 'battletech') {
            event.preventDefault();
            previous();
          }
          break;
        case 'd':
          event.preventDefault();
          setDiceOpen(true);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, previous, undo, system.id]);

  return (
    <div className="app" style={{ '--accent': system.accent } as CSSProperties}>
      <Header onOpenDice={() => setDiceOpen(true)} />
      <main className="layout">
        {system.showBattletech ? <BattletechPanel /> : null}
        <AddCombatant />
        <InitiativeList />
        <footer className="hotkeys">
          <span>
            <kbd>N</kbd> next turn
          </span>
          <span>
            <kbd>P</kbd> previous
          </span>
          <span>
            <kbd>A</kbd> add
          </span>
          <span>
            <kbd>D</kbd> dice
          </span>
          <span>
            <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo
          </span>
          <span className="hotkeys-note">Data is saved in this browser automatically.</span>
        </footer>
      </main>
      <DicePanel open={diceOpen} onClose={() => setDiceOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Tracker />
    </StoreProvider>
  );
}
