import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { SYSTEM_LIST } from '../data/systems';
import { collectExportablePcs } from '../lib/factory';
import type { SystemId } from '../types';
import {
  exportEncounter,
  exportLibrary,
  exportPcs,
  parseImport,
  parsePcs,
  readFile,
} from '../state/persistence';

interface HeaderProps {
  onOpenDice: () => void;
}

export function Header({ onOpenDice }: HeaderProps) {
  const {
    data,
    encounter,
    system,
    canUndo,
    undo,
    selectEncounter,
    createEncounter,
    duplicateEncounterById,
    deleteEncounter,
    renameEncounter,
    setSystem,
    setTheme,
    importData,
    importPcs,
    resetAll,
    restoreAll,
    notify,
    templates,
  } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pcsFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const handleRename = () => {
    const name = window.prompt('Encounter name', encounter.name);
    if (name !== null) renameEncounter(encounter.id, name);
    setMenuOpen(false);
  };

  const handleNew = () => {
    createEncounter(encounter.system);
    notify('Created a new encounter');
  };

  const handleDelete = () => {
    setMenuOpen(false);
    if (
      window.confirm(
        `Delete "${encounter.name}"? This removes the encounter and its combatants.`,
      )
    ) {
      deleteEncounter(encounter.id);
      notify('Encounter deleted');
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const text = await readFile(file);
      const result = parseImport(text);
      if (result.error || !result.data) {
        notify(result.error ?? 'Could not import that file');
        return;
      }
      importData(result.data);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not read that file');
    }
  };

  const handleExportPcs = () => {
    const pcs = collectExportablePcs(templates, encounter.combatants);
    if (pcs.length === 0) {
      notify('No PCs to export');
      setMenuOpen(false);
      return;
    }
    exportPcs(pcs);
    setMenuOpen(false);
    notify(`${pcs.length} PC${pcs.length === 1 ? '' : 's'} exported`);
  };

  const handleImportPcs = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const text = await readFile(file);
      const result = parsePcs(text);
      if (result.error || !result.characters) {
        notify(result.error ?? 'Could not import that file');
        return;
      }
      importPcs(result.characters);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not read that file');
    }
  };

  const handleSystem = (value: SystemId) => {
    if (value === system.id) return;
    if (
      encounter.combatants.length > 0 &&
      !window.confirm(
        `Switch to ${SYSTEM_LIST.find((entry) => entry.id === value)?.name}? Combatants are kept, but the turn mode and trackers change.`,
      )
    ) {
      return;
    }
    setSystem(value);
  };

  const isDark = data.settings.theme === 'dark';

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22">
            <path
              d="M12 2 20 6v6c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-4Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            />
            <path d="M12 6.5v9M8.5 10h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </div>
        <div className="brand-text">
          <h1>Initiative Tracker</h1>
          <span>{system.short}</span>
        </div>
      </div>

      <div className="encounter-controls">
        <label className="sr-only" htmlFor="encounter-select">
          Active encounter
        </label>
        <select
          id="encounter-select"
          className="select encounter-select"
          value={encounter.id}
          onChange={(event) => selectEncounter(event.target.value)}
        >
          {data.encounters.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
        <button className="btn icon" onClick={handleNew} title="New encounter" aria-label="New encounter">
          +
        </button>
        <label className="sr-only" htmlFor="system-select">
          Game system
        </label>
        <select
          id="system-select"
          className="select system-select"
          value={system.id}
          onChange={(event) => handleSystem(event.target.value as SystemId)}
          title="Game system"
        >
          {SYSTEM_LIST.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.short}
            </option>
          ))}
        </select>
        <div className="menu-anchor" ref={menuRef}>
          <button
            className="btn icon"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            title="Encounter menu"
          >
            ⋯
          </button>
          {menuOpen ? (
            <div className="menu" role="menu">
              <button role="menuitem" onClick={handleRename}>
                Rename encounter
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  duplicateEncounterById(encounter.id);
                  setMenuOpen(false);
                  notify('Encounter duplicated');
                }}
              >
                Duplicate encounter
              </button>
              <div className="menu-sep" />
              <button
                role="menuitem"
                onClick={() => {
                  exportEncounter(encounter, data.settings);
                  setMenuOpen(false);
                  notify('Encounter exported');
                }}
              >
                Export this encounter
              </button>
              <button role="menuitem" onClick={handleExportPcs}>
                Export PCs…
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  exportLibrary(data);
                  setMenuOpen(false);
                  notify('Backup exported');
                }}
              >
                Export full backup
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  fileRef.current?.click();
                  setMenuOpen(false);
                }}
              >
                Import JSON…
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  pcsFileRef.current?.click();
                  setMenuOpen(false);
                }}
              >
                Import PCs…
              </button>
              <div className="menu-sep" />
              <button
                role="menuitem"
                onClick={() => {
                  restoreAll();
                  setMenuOpen(false);
                }}
              >
                Restore all HP
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setTheme(isDark ? 'light' : 'dark');
                  setMenuOpen(false);
                }}
              >
                Switch to {isDark ? 'light' : 'dark'} theme
              </button>
              <div className="menu-sep" />
              <button role="menuitem" className="danger" onClick={handleDelete}>
                Delete encounter
              </button>
              <button
                role="menuitem"
                className="danger"
                onClick={() => {
                  setMenuOpen(false);
                  if (
                    window.confirm(
                      'Reset all data? Every encounter will be deleted and a fresh one created.',
                    )
                  ) {
                    resetAll();
                  }
                }}
              >
                Reset all data
              </button>
            </div>
          ) : null}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden-input"
          onChange={handleImport}
        />
        <input
          ref={pcsFileRef}
          type="file"
          accept="application/json,.json"
          className="hidden-input"
          onChange={handleImportPcs}
        />
      </div>

      <div className="top-actions">
        <button className="btn" onClick={onOpenDice} title="Dice roller (D)" aria-label="Dice roller">
          <span className="d20-glyph" aria-hidden="true">
            d20
          </span>
          <span className="btn-label">Dice</span>
        </button>
        <button
          className="btn"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <span aria-hidden="true">↶</span>
          <span className="btn-label">Undo</span>
        </button>
        <button
          className="btn icon"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label="Toggle theme"
        >
          {isDark ? '☾' : '☀'}
        </button>
      </div>
    </header>
  );
}
