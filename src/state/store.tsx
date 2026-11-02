import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  AppData,
  AppSettings,
  Combatant,
  CombatantTemplate,
  ConditionInstance,
  Encounter,
  SystemId,
  Track,
} from '../types';
import { getSystem, type SystemPreset } from '../data/systems';
import {
  createAppData,
  createCombatant,
  createEncounter,
  duplicateCombatant,
  duplicateEncounter,
  uid,
} from '../lib/factory';
import {
  compareCombatants,
  getActiveCombatant,
  nextTurn,
  previousTurn,
  rerollAll,
  sortForDisplay,
} from '../lib/initiative';
import { damageCombatant, healCombatant, restoreCombatant } from '../lib/hp';
import {
  activateUnit,
  nextSide,
  rollSides,
  sideNames,
  syncSides,
} from '../lib/battletech';
import { rollInitiativeScore as rollScore, type DiceResult } from '../lib/dice';
import { loadData, saveData } from './persistence';

export interface DiceLogEntry {
  id: string;
  label: string;
  result: DiceResult;
  at: number;
}

interface State {
  data: AppData;
  undo: Record<string, Encounter[]>;
  diceLog: DiceLogEntry[];
}

type Action =
  | { type: 'mutate'; fn: (encounter: Encounter) => Encounter }
  | { type: 'undo' }
  | { type: 'select'; id: string }
  | { type: 'create'; system: SystemId }
  | { type: 'duplicateEncounter'; id: string }
  | { type: 'deleteEncounter'; id: string }
  | { type: 'renameEncounter'; id: string; name: string }
  | { type: 'setSystem'; system: SystemId }
  | { type: 'import'; data: AppData }
  | { type: 'recordTemplates'; templates: CombatantTemplate[] }
  | { type: 'logRoll'; entry: DiceLogEntry }
  | { type: 'clearDiceLog' }
  | { type: 'setTheme'; theme: AppSettings['theme'] }
  | { type: 'reset' };

function activeEncounter(data: AppData): Encounter {
  return data.encounters.find((encounter) => encounter.id === data.activeId) ?? data.encounters[0];
}

function sanitizeActive(encounter: Encounter): Encounter {
  const alive = encounter.combatants.filter((combatant) => !combatant.defeated);
  const stillValid = alive.some((combatant) => combatant.id === encounter.activeId);
  if (stillValid || encounter.system === 'battletech') return encounter;
  const first = [...alive].sort(compareCombatants)[0];
  return { ...encounter, activeId: first?.id ?? null };
}

function replaceEncounter(data: AppData, encounter: Encounter): AppData {
  return {
    ...data,
    encounters: data.encounters.map((entry) =>
      entry.id === encounter.id ? encounter : entry,
    ),
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'mutate': {
      const current = activeEncounter(state.data);
      if (!current) return state;
      let next = action.fn(structuredClone(current));
      if (next.system === 'battletech') next = syncSides(next);
      next = sanitizeActive({ ...next, updatedAt: Date.now() });
      if (next === current) return state;
      const stack = state.undo[current.id] ?? [];
      return {
        ...state,
        data: replaceEncounter(state.data, next),
        undo: {
          ...state.undo,
          [current.id]: [...stack, structuredClone(current)].slice(-60),
        },
      };
    }
    case 'undo': {
      const current = activeEncounter(state.data);
      const stack = state.undo[current.id] ?? [];
      const previous = stack[stack.length - 1];
      if (!previous) return state;
      return {
        ...state,
        data: replaceEncounter(state.data, previous),
        undo: { ...state.undo, [current.id]: stack.slice(0, -1) },
      };
    }
    case 'select': {
      if (!state.data.encounters.some((encounter) => encounter.id === action.id)) return state;
      return { ...state, data: { ...state.data, activeId: action.id } };
    }
    case 'create': {
      const encounter = createEncounter(
        action.system,
        `Encounter ${state.data.encounters.length + 1}`,
      );
      return {
        ...state,
        data: {
          ...state.data,
          encounters: [...state.data.encounters, encounter],
          activeId: encounter.id,
        },
        undo: { ...state.undo, [encounter.id]: [] },
      };
    }
    case 'duplicateEncounter': {
      const source = state.data.encounters.find((encounter) => encounter.id === action.id);
      if (!source) return state;
      const copy = duplicateEncounter(source);
      return {
        ...state,
        data: {
          ...state.data,
          encounters: [...state.data.encounters, copy],
          activeId: copy.id,
        },
        undo: { ...state.undo, [copy.id]: [] },
      };
    }
    case 'deleteEncounter': {
      const remaining = state.data.encounters.filter(
        (encounter) => encounter.id !== action.id,
      );
      if (remaining.length === 0) {
        const fresh = createEncounter('dnd5e', 'New encounter');
        return {
          ...state,
          data: { ...state.data, encounters: [fresh], activeId: fresh.id },
          undo: { [fresh.id]: [] },
        };
      }
      const activeId =
        state.data.activeId === action.id ? remaining[0].id : state.data.activeId;
      return {
        ...state,
        data: { ...state.data, encounters: remaining, activeId },
      };
    }
    case 'renameEncounter': {
      const name = action.name.slice(0, 120) || 'Untitled encounter';
      return {
        ...state,
        data: {
          ...state.data,
          encounters: state.data.encounters.map((encounter) =>
            encounter.id === action.id
              ? { ...encounter, name, updatedAt: Date.now() }
              : encounter,
          ),
        },
      };
    }
    case 'setSystem': {
      const current = activeEncounter(state.data);
      const next: Encounter = {
        ...current,
        system: action.system,
        sideRolls: {},
        btOrder: [],
        btIndex: 0,
        combatants: current.combatants.map((combatant) => ({
          ...combatant,
          acted: false,
        })),
        updatedAt: Date.now(),
      };
      return {
        ...state,
        data: replaceEncounter(state.data, next.system === 'battletech' ? syncSides(next) : next),
        undo: {
          ...state.undo,
          [current.id]: [...(state.undo[current.id] ?? []), structuredClone(current)].slice(-60),
        },
      };
    }
    case 'import': {
      if (action.data.encounters.length === 0) return state;
      const first = action.data.encounters[0];
      return {
        ...state,
        data: {
          ...state.data,
          encounters: [...state.data.encounters, ...action.data.encounters],
          activeId: first.id,
        },
        undo: { ...state.undo, [first.id]: [] },
      };
    }
    case 'recordTemplates': {
      return { ...state, data: { ...state.data, templates: action.templates } };
    }
    case 'logRoll': {
      return { ...state, diceLog: [action.entry, ...state.diceLog].slice(0, 40) };
    }
    case 'clearDiceLog':
      return { ...state, diceLog: [] };
    case 'setTheme':
      return { ...state, data: { ...state.data, settings: { ...state.data.settings, theme: action.theme } } };
    case 'reset': {
      return { data: createAppData(), undo: {}, diceLog: [] };
    }
    default:
      return state;
  }
}

interface StoreApi {
  data: AppData;
  templates: CombatantTemplate[];
  encounter: Encounter;
  system: SystemPreset;
  displayCombatants: Combatant[];
  activeCombatant: Combatant | null;
  canUndo: boolean;
  undoCount: number;
  diceLog: DiceLogEntry[];
  toast: string | null;
  notify: (message: string) => void;
  mutate: (fn: (encounter: Encounter) => Encounter) => void;
  undo: () => void;
  updateCombatant: (
    id: string,
    update: Partial<Combatant> | ((combatant: Combatant) => Combatant),
  ) => void;
  addCombatants: (
    drafts: Array<Partial<Combatant>>,
    template?: CombatantTemplate,
  ) => void;
  removeCombatant: (id: string) => void;
  duplicateCombatantById: (id: string) => void;
  toggleDefeated: (id: string) => void;
  setActiveCombatant: (id: string) => void;
  setInitiative: (id: string, value: number | null) => void;
  rollInitiativeFor: (id: string) => void;
  rollAllInitiatives: () => void;
  next: () => void;
  previous: () => void;
  damage: (id: string, amount: number) => void;
  heal: (id: string, amount: number) => void;
  adjustPool: (
    id: string,
    pool: 'hp' | 'secondary' | 'armor' | 'structure',
    delta: number,
  ) => void;
  setPool: (
    id: string,
    pool: 'hp' | 'secondary' | 'armor' | 'structure',
    current: number,
  ) => void;
  setTempHp: (id: string, temp: number) => void;
  addCondition: (id: string, label: string, rounds: number | null) => void;
  removeCondition: (id: string, conditionId: string) => void;
  restoreAll: () => void;
  setSide: (id: string, side: string) => void;
  setHeat: (id: string, heat: number) => void;
  setPilotHits: (id: string, hits: number) => void;
  rollBtSides: () => void;
  nextBtSide: () => void;
  activateBtUnit: (id: string) => void;
  selectEncounter: (id: string) => void;
  createEncounter: (system: SystemId) => void;
  duplicateEncounterById: (id: string) => void;
  deleteEncounter: (id: string) => void;
  renameEncounter: (id: string, name: string) => void;
  setSystem: (system: SystemId) => void;
  setTheme: (theme: AppSettings['theme']) => void;
  logRoll: (label: string, result: DiceResult) => void;
  clearDiceLog: () => void;
  importData: (data: AppData) => void;
  resetAll: () => void;
}

const StoreContext = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    data: loadData(),
    undo: {},
    diceLog: [],
  }));
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const encounter = activeEncounter(state.data) ?? state.data.encounters[0];
  const system = getSystem(encounter?.system ?? 'generic');

  useEffect(() => {
    saveData(state.data);
  }, [state.data]);

  useEffect(() => {
    document.documentElement.dataset.theme = state.data.settings.theme;
  }, [state.data.settings.theme]);

  useEffect(() => {
    return () => {
      if (toastTimer.current !== undefined) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current !== undefined) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const mutate = useCallback((fn: (enc: Encounter) => Encounter) => {
    dispatch({ type: 'mutate', fn });
  }, []);

  const updateCombatant = useCallback(
    (id: string, update: Partial<Combatant> | ((combatant: Combatant) => Combatant)) => {
      mutate((enc) => ({
        ...enc,
        combatants: enc.combatants.map((combatant) => {
          if (combatant.id !== id) return combatant;
          return typeof update === 'function'
            ? update(combatant)
            : { ...combatant, ...update };
        }),
      }));
    },
    [mutate],
  );

  const updateTrack = useCallback(
    (id: string, pool: 'hp' | 'secondary' | 'armor' | 'structure', fn: (track: Track) => Track) => {
      updateCombatant(id, (combatant) => ({
        ...combatant,
        [pool]: fn(combatant[pool]),
      }));
    },
    [updateCombatant],
  );

  const addCombatants = useCallback(
    (drafts: Array<Partial<Combatant>>, template?: CombatantTemplate) => {
      const created = drafts.map((draft) => createCombatant(draft));
      mutate((enc) => {
        const combatants = [...enc.combatants, ...created];
        const activeId =
          enc.activeId ??
          [...combatants]
            .filter((combatant) => !combatant.defeated && combatant.initiative !== null)
            .sort(compareCombatants)[0]?.id ??
          null;
        return { ...enc, combatants, activeId };
      });
      if (template) {
        const existing = state.data.templates;
        if (!existing.some((entry) => entry.role === template.role && entry.name === template.name)) {
          dispatch({ type: 'recordTemplates', templates: [...existing, template] });
        }
      }
      notify(
        created.length === 1
          ? `Added ${created[0].name}`
          : `Added ${created.length} combatants`,
      );
    },
    [mutate, dispatch, notify, state.data.templates],
  );

  const damage = useCallback(
    (id: string, amount: number) => {
      mutate((enc) => ({
        ...enc,
        combatants: enc.combatants.map((combatant) =>
          combatant.id === id
            ? damageCombatant(combatant, enc.system, amount)
            : combatant,
        ),
      }));
    },
    [mutate],
  );

  const heal = useCallback(
    (id: string, amount: number) => {
      updateCombatant(id, (combatant) => healCombatant(combatant, amount));
    },
    [updateCombatant],
  );

  const adjustPool = useCallback(
    (
      id: string,
      pool: 'hp' | 'secondary' | 'armor' | 'structure',
      delta: number,
    ) => {
      updateTrack(id, pool, (track) => ({
        ...track,
        current: Math.max(0, Math.min(track.max, track.current + Math.round(delta))),
      }));
    },
    [updateTrack],
  );

  const setPool = useCallback(
    (id: string, pool: 'hp' | 'secondary' | 'armor' | 'structure', current: number) => {
      updateTrack(id, pool, (track) => ({
        ...track,
        current: Math.max(0, Math.min(track.max, Math.round(current))),
      }));
    },
    [updateTrack],
  );

  const setTempHp = useCallback(
    (id: string, temp: number) => {
      updateTrack(id, 'hp', (track) => ({ ...track, temp: Math.max(0, Math.round(temp)) }));
    },
    [updateTrack],
  );

  const setInitiative = useCallback(
    (id: string, value: number | null) => {
      mutate((enc) => {
        const combatants = enc.combatants.map((combatant) =>
          combatant.id === id ? { ...combatant, initiative: value } : combatant,
        );
        const activeId =
          enc.activeId ??
          [...combatants]
            .filter((combatant) => !combatant.defeated && combatant.initiative !== null)
            .sort(compareCombatants)[0]?.id ??
          null;
        return { ...enc, combatants, activeId };
      });
    },
    [mutate],
  );

  const rollInitiativeFor = useCallback(
    (id: string) => {
      const combatant = encounter.combatants.find((entry) => entry.id === id);
      if (!combatant) return;
      const mode = encounter.system === 'shadowrun' ? 'shadowrun' : 'd20';
      const result = rollScore(mode, combatant.initMod);
      dispatch({ type: 'logRoll', entry: { id: uid('roll'), label: `${combatant.name} initiative`, result, at: Date.now() } });
      mutate((enc) => {
        const combatants = enc.combatants.map((entry) =>
          entry.id === id ? { ...entry, initiative: result.total } : entry,
        );
        const activeId =
          enc.activeId ??
          [...combatants]
            .filter((entry) => !entry.defeated && entry.initiative !== null)
            .sort(compareCombatants)[0]?.id ??
          null;
        return { ...enc, combatants, activeId };
      });
      notify(`${combatant.name}: initiative ${result.total}`);
    },
    [encounter, mutate, notify],
  );

  const rollAllInitiatives = useCallback(() => {
    if (encounter.system === 'battletech') {
      dispatch({ type: 'mutate', fn: (enc) => rollSides(enc) });
      notify('Rolled side initiative');
      return;
    }
    dispatch({ type: 'mutate', fn: (enc) => rerollAll(enc) });
    notify('Rolled initiative for everyone');
  }, [encounter.system, notify]);

  const next = useCallback(() => {
    mutate((enc) => (enc.system === 'battletech' ? nextSide(enc) : nextTurn(enc)));
  }, [mutate]);

  const previous = useCallback(() => {
    mutate((enc) => previousTurn(enc));
  }, [mutate]);

  const addCondition = useCallback(
    (id: string, label: string, rounds: number | null) => {
      const clean = label.trim();
      if (!clean) return;
      const condition: ConditionInstance = {
        id: uid('cond'),
        label: clean.slice(0, 60),
        rounds,
      };
      updateCombatant(id, (combatant) => ({
        ...combatant,
        conditions: [...combatant.conditions, condition],
      }));
    },
    [updateCombatant],
  );

  const removeCondition = useCallback(
    (id: string, conditionId: string) => {
      updateCombatant(id, (combatant) => ({
        ...combatant,
        conditions: combatant.conditions.filter((condition) => condition.id !== conditionId),
      }));
    },
    [updateCombatant],
  );

  const restoreAll = useCallback(() => {
    mutate((enc) => {
      const combatants = enc.combatants.map(restoreCombatant);
      return {
        ...enc,
        combatants,
        activeId: combatants[0]?.id ?? null,
      };
    });
    notify('Restored everyone to full health');
  }, [mutate, notify]);

  const setSide = useCallback(
    (id: string, side: string) => {
      mutate((enc) => ({
        ...enc,
        combatants: enc.combatants.map((combatant) =>
          combatant.id === id ? { ...combatant, side: side.slice(0, 60) || 'Unassigned' } : combatant,
        ),
        sideRolls: {},
        btOrder: [],
        btIndex: 0,
      }));
    },
    [mutate],
  );

  const setHeat = useCallback(
    (id: string, heat: number) => {
      updateCombatant(id, { heat: Math.max(0, Math.round(heat)) });
    },
    [updateCombatant],
  );

  const setPilotHits = useCallback(
    (id: string, hits: number) => {
      updateCombatant(id, { pilotHits: Math.max(0, Math.min(6, Math.round(hits))) });
    },
    [updateCombatant],
  );

  const rollBtSides = useCallback(() => {
    if (sideNames(encounter).length === 0) {
      notify('Add some units with sides first');
      return;
    }
    dispatch({ type: 'mutate', fn: (enc) => rollSides(enc) });
    notify('Rolled side initiative');
  }, [encounter, notify]);

  const api = useMemo<StoreApi>(
    () => ({
      data: state.data,
      templates: state.data.templates,
      encounter,
      system,
      displayCombatants: sortForDisplay(encounter.combatants),
      activeCombatant: getActiveCombatant(encounter),
      canUndo: (state.undo[encounter.id]?.length ?? 0) > 0,
      undoCount: state.undo[encounter.id]?.length ?? 0,
      diceLog: state.diceLog,
      toast,
      notify,
      mutate,
      undo: () => dispatch({ type: 'undo' }),
      updateCombatant,
      addCombatants,
      removeCombatant: (id) =>
        mutate((enc) => ({
          ...enc,
          combatants: enc.combatants.filter((combatant) => combatant.id !== id),
        })),
      duplicateCombatantById: (id) =>
        mutate((enc) => {
          const source = enc.combatants.find((combatant) => combatant.id === id);
          if (!source) return enc;
          return { ...enc, combatants: [...enc.combatants, duplicateCombatant(source)] };
        }),
      toggleDefeated: (id) =>
        updateCombatant(id, (combatant) => ({
          ...combatant,
          defeated: !combatant.defeated,
        })),
      setActiveCombatant: (id) => mutate((enc) => ({ ...enc, activeId: id })),
      setInitiative,
      rollInitiativeFor,
      rollAllInitiatives,
      next,
      previous,
      damage,
      heal,
      adjustPool,
      setPool,
      setTempHp,
      addCondition,
      removeCondition,
      restoreAll,
      setSide,
      setHeat,
      setPilotHits,
      rollBtSides,
      nextBtSide: () => dispatch({ type: 'mutate', fn: (enc) => nextSide(enc) }),
      activateBtUnit: (id) =>
        dispatch({ type: 'mutate', fn: (enc) => activateUnit(enc, id) }),
      selectEncounter: (id) => dispatch({ type: 'select', id }),
      createEncounter: (systemId) => dispatch({ type: 'create', system: systemId }),
      duplicateEncounterById: (id) => dispatch({ type: 'duplicateEncounter', id }),
      deleteEncounter: (id) => dispatch({ type: 'deleteEncounter', id }),
      renameEncounter: (id, name) => dispatch({ type: 'renameEncounter', id, name }),
      setSystem: (systemId) => dispatch({ type: 'setSystem', system: systemId }),
      setTheme: (theme) => dispatch({ type: 'setTheme', theme }),
      logRoll: (label, result) =>
        dispatch({
          type: 'logRoll',
          entry: { id: uid('roll'), label, result, at: Date.now() },
        }),
      clearDiceLog: () => dispatch({ type: 'clearDiceLog' }),
      importData: (data) => {
        dispatch({ type: 'import', data });
        notify(
          `Imported ${data.encounters.length} encounter${data.encounters.length === 1 ? '' : 's'}`,
        );
      },
      resetAll: () => {
        dispatch({ type: 'reset' });
        notify('All data reset');
      },
    }),
    [
      state.data,
      state.data.templates,
      encounter,
      system,
      state.undo,
      state.diceLog,
      toast,
      notify,
      mutate,
      updateCombatant,
      addCombatants,
      setInitiative,
      rollInitiativeFor,
      rollAllInitiatives,
      next,
      previous,
      damage,
      heal,
      adjustPool,
      setPool,
      setTempHp,
      addCondition,
      removeCondition,
      restoreAll,
      setSide,
      setHeat,
      setPilotHits,
      rollBtSides,
    ],
  );

  return (
    <StoreContext.Provider value={api}>
      {children}
      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreApi {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used inside StoreProvider');
  return context;
}


