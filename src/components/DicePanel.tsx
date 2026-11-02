import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useStore } from '../state/store';
import { describeResult, rollD20, rollExpression, type AdvantageMode, type DiceResult } from '../lib/dice';

const DICE = [4, 6, 8, 10, 12, 20, 100];

interface DicePanelProps {
  open: boolean;
  onClose: () => void;
}

export function DicePanel({ open, onClose }: DicePanelProps) {
  const { diceLog, logRoll, clearDiceLog } = useStore();
  const [expression, setExpression] = useState('1d20');
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<DiceResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    document.body.classList.add('no-scroll');
    return () => {
      window.clearTimeout(timer);
      document.body.classList.remove('no-scroll');
    };
  }, [open]);

  if (!open) return null;

  const roll = (next: DiceResult, label: string) => {
    setError(null);
    setLastResult(next);
    logRoll(label, next);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const outcome = rollExpression(expression);
    if (!outcome.ok) {
      setError(outcome.error);
      return;
    }
    roll(outcome.result, expression.trim() || 'roll');
  };

  const quickDie = (sides: number) => {
    const outcome = rollExpression(`1d${sides}`);
    if (outcome.ok) roll(outcome.result, `d${sides}`);
  };

  const advantage = (mode: AdvantageMode) => {
    roll(rollD20(mode), mode === 'normal' ? 'd20' : `d20 ${mode}`);
  };

  return (
    <div className="overlay" onMouseDown={onClose}>
      <aside
        className="dice-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Dice roller"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dice-head">
          <div>
            <h2>Dice roller</h2>
            <p className="muted">Expressions like 2d6+3, 4d6 or d20-1.</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dice roller">
            ×
          </button>
        </div>

        <form className="dice-form" onSubmit={submit}>
          <input
            ref={inputRef}
            value={expression}
            onChange={(event) => setExpression(event.target.value)}
            placeholder="2d6+3"
            aria-label="Dice expression"
            autoComplete="off"
          />
          <button type="submit" className="btn primary">
            Roll
          </button>
        </form>
        {error ? <p className="form-error">{error}</p> : null}

        <div className="dice-quick">
          {DICE.map((sides) => (
            <button key={sides} type="button" className="die-btn" onClick={() => quickDie(sides)}>
              d{sides}
            </button>
          ))}
        </div>

        <div className="adv-row">
          <span className="mini-label">d20</span>
          <button type="button" className="btn small" onClick={() => advantage('normal')}>
            Normal
          </button>
          <button type="button" className="btn small" onClick={() => advantage('advantage')}>
            Advantage
          </button>
          <button type="button" className="btn small" onClick={() => advantage('disadvantage')}>
            Disadvantage
          </button>
        </div>

        <div className={`dice-result ${lastResult ? 'has-result' : ''}`}>
          {lastResult ? (
            <>
              <span className="dice-total">{lastResult.total}</span>
              <div className="dice-detail">
                <span>{lastResult.expression}</span>
                <span className="muted">{describeResult(lastResult)}</span>
                {lastResult.note ? <span className="muted">{lastResult.note}</span> : null}
              </div>
            </>
          ) : (
            <span className="muted">Roll something.</span>
          )}
        </div>

        <div className="dice-log-head">
          <h3>Recent rolls</h3>
          {diceLog.length > 0 ? (
            <button type="button" className="btn small" onClick={clearDiceLog}>
              Clear
            </button>
          ) : null}
        </div>
        <div className="dice-log">
          {diceLog.length === 0 ? (
            <p className="muted">No rolls yet.</p>
          ) : (
            diceLog.map((entry) => (
              <div className="log-entry" key={entry.id}>
                <span className="log-total">{entry.result.total}</span>
                <span className="log-label">{entry.label}</span>
                <span className="log-detail">{describeResult(entry.result)}</span>
                <span className="log-time">
                  {new Date(entry.at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
