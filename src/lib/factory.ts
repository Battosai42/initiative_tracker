import {
  DATA_VERSION,
  type AppData,
  type Combatant,
  type CombatantTemplate,
  type ConditionInstance,
  type Disposition,
  type Encounter,
  type Role,
  type SavingThrows,
  type SystemId,
  type Track,
} from '../types';
import { SYSTEMS } from '../data/systems';
import { defaultSaves } from '../data/saves';

let counter = 0;

export function uid(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

export function track(max = 0, current = max): Track {
  const safeMax = Math.max(0, Math.floor(max));
  return {
    current: Math.max(0, Math.min(safeMax, Math.floor(current))),
    max: safeMax,
    temp: 0,
  };
}

export function defaultDisposition(role: Role): Disposition {
  if (role === 'monster') return 'unfriendly';
  if (role === 'npc') return 'neutral';
  return 'friendly';
}

export function createCombatant(partial: Partial<Combatant> = {}): Combatant {
  const role = partial.role ?? 'npc';
  return {
    id: uid('c'),
    name: 'Combatant',
    role,
    disposition: partial.disposition ?? defaultDisposition(role),
    side: 'Players',
    initiative: null,
    initMod: 0,
    tiebreak: 0,
    hp: track(10),
    secondary: track(0),
    resolve: 0,
    conditions: [],
    notes: '',
    defeated: false,
    acted: false,
    deathSaves: { successes: 0, failures: 0 },
    armor: track(0),
    structure: track(0),
    heat: 0,
    pilotHits: 0,
    ac: 0,
    eac: 0,
    kac: 0,
    shield: 0,
    saves: defaultSaves(),
    dr: 0,
    sr: 0,
    fort: 0,
    reflex: 0,
    con: 0,
    regen: 0,
    cr: 0,
    spellDC: 0,
    ...partial,
  };
}

export function createEncounter(system: SystemId = 'dnd5e', name = 'New encounter'): Encounter {
  const now = Date.now();
  return {
    id: uid('e'),
    name,
    system,
    round: 1,
    activeId: null,
    combatants: [],
    sideRolls: {},
    btOrder: [],
    btIndex: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function createAppData(): AppData {
  const encounter = createEncounter('dnd5e', 'My first encounter');
  return {
    version: DATA_VERSION,
    encounters: [encounter],
    activeId: encounter.id,
    templates: [],
    settings: { theme: 'dark' },
  };
}

export function duplicateCombatant(source: Combatant): Combatant {
  return {
    ...structuredClone(source),
    id: uid('c'),
    name: `${source.name} (copy)`,
    conditions: source.conditions.map((condition) => ({ ...condition, id: uid('cond') })),
  };
}

/**
 * Reduce a combatant to its "template" shape so the same PC/NPC/monster can be
 * re-added from the name-field dropdown without re-typing every field.
 */
export function combatantToTemplate(combatant: Combatant): CombatantTemplate {
  return {
    name: combatant.name,
    role: combatant.role,
    disposition: combatant.disposition,
    side: combatant.side,
    initMod: combatant.initMod,
    tiebreak: combatant.tiebreak,
    hpMax: combatant.hp.max,
    secondaryMax: combatant.secondary.max,
    resolve: combatant.resolve,
    armor: combatant.armor.max,
    structure: combatant.structure.max,
    ac: combatant.ac,
    eac: combatant.eac,
    kac: combatant.kac,
    shield: combatant.shield,
    saves: { ...combatant.saves },
    dr: combatant.dr,
    sr: combatant.sr,
    fort: combatant.fort,
    reflex: combatant.reflex,
    con: combatant.con,
    regen: combatant.regen,
    cr: combatant.cr,
    spellDC: combatant.spellDC,
  };
}

/**
 * Collect the PCs to export: every PC in the library plus every PC currently
 * present in an encounter, de-duplicated by (role, name). Exporting from the
 * encounter too means PCs that live only in the combat list (for example ones
 * added by importing an encounter) are still recognised.
 */
export function collectExportablePcs(
  templates: CombatantTemplate[],
  combatants: Combatant[],
): CombatantTemplate[] {
  const seen = new Set<string>();
  const pcs: CombatantTemplate[] = [];
  const consider = (template: CombatantTemplate) => {
    const key = `${template.role}:${template.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      pcs.push(template);
    }
  };
  for (const entry of templates) {
    if (entry.role === 'pc') consider(entry);
  }
  for (const combatant of combatants) {
    if (combatant.role !== 'pc') continue;
    consider(combatantToTemplate(combatant));
  }
  return pcs;
}

export function duplicateEncounter(source: Encounter, name?: string): Encounter {
  const now = Date.now();
  return {
    ...structuredClone(source),
    id: uid('e'),
    name: name ?? `${source.name} (copy)`,
    combatants: source.combatants.map((combatant) => ({
      ...structuredClone(combatant),
      id: uid('c'),
      conditions: combatant.conditions.map((condition) => ({ ...condition, id: uid('cond') })),
    })),
    createdAt: now,
    updatedAt: now,
  };
}

/* ------------------------------------------------------------------ */
/* Normalisation (used for localStorage loads and JSON imports)        */
/* ------------------------------------------------------------------ */

type Json = Record<string, unknown>;

function record(value: unknown): Json {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Json)
    : {};
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normTrack(value: unknown, fallbackMax = 0): Track {
  const raw = record(value);
  const max = Math.max(0, Math.round(num(raw.max, fallbackMax)));
  const current = Math.max(0, Math.min(max, Math.round(num(raw.current, max))));
  return {
    current,
    max,
    temp: Math.max(0, Math.round(num(raw.temp, 0))),
  };
}

function normSaves(value: unknown): SavingThrows {
  const raw = record(value);
  return {
    str: Math.round(num(raw.str, 0)),
    dex: Math.round(num(raw.dex, 0)),
    con: Math.round(num(raw.con, 0)),
    int: Math.round(num(raw.int, 0)),
    wis: Math.round(num(raw.wis, 0)),
    cha: Math.round(num(raw.cha, 0)),
  };
}

function normConditions(value: unknown): ConditionInstance[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const raw = record(entry);
    const label = str(raw.label).trim();
    if (!label) return [];
    const rounds = raw.rounds === null || raw.rounds === undefined ? null : Math.max(0, Math.round(num(raw.rounds, 0)));
    return [{ id: uid('cond'), label, rounds }];
  });
}

function normRole(value: unknown): Role {
  return value === 'pc' || value === 'monster' || value === 'npc' ? value : 'npc';
}

function normDisposition(value: unknown, role: Role): Disposition {
  if (value === 'friendly' || value === 'neutral' || value === 'unfriendly') return value;
  return defaultDisposition(role);
}

export function normalizeTemplate(value: unknown): CombatantTemplate | null {
  const raw = record(value);
  const name = str(raw.name).trim();
  if (!name) return null;
  const role = normRole(raw.role);
  return {
    name: name.slice(0, 120),
    role,
    disposition: normDisposition(raw.disposition, role),
    side: str(raw.side, role === 'pc' ? 'Players' : 'OpFor').slice(0, 60) || 'OpFor',
    initMod: Math.round(num(raw.initMod, 0)),
    tiebreak: Math.round(num(raw.tiebreak, 0)),
    hpMax: Math.max(0, Math.round(num(raw.hpMax, 10))),
    secondaryMax: Math.max(0, Math.round(num(raw.secondaryMax, 0))),
    resolve: Math.max(0, Math.round(num(raw.resolve, 0))),
    armor: Math.max(0, Math.round(num(raw.armor, 0))),
    structure: Math.max(0, Math.round(num(raw.structure, 0))),
    ac: Math.max(0, Math.round(num(raw.ac, 0))),
    eac: Math.max(0, Math.round(num(raw.eac, 0))),
    kac: Math.max(0, Math.round(num(raw.kac, 0))),
    shield: Math.max(0, Math.round(num(raw.shield, 0))),
    saves: normSaves(raw.saves),
    dr: Math.max(0, Math.round(num(raw.dr, 0))),
    sr: Math.max(0, Math.round(num(raw.sr, 0))),
    fort: Math.round(num(raw.fort, 0)),
    reflex: Math.round(num(raw.reflex, 0)),
    con: Math.round(num(raw.con, 0)),
    regen: Math.max(0, Math.round(num(raw.regen, 0))),
    cr: Math.max(0, Math.round(num(raw.cr, 0))),
    spellDC: Math.max(0, Math.round(num(raw.spellDC, 0))),
  };
}

function normSystem(value: unknown): SystemId {
  return typeof value === 'string' && value in SYSTEMS ? (value as SystemId) : 'generic';
}

export function normalizeCombatant(value: unknown, remapIds = false): Combatant {
  const raw = record(value);
  const role = normRole(raw.role);
  return {
    id: remapIds || !str(raw.id) ? uid('c') : str(raw.id),
    name: str(raw.name, 'Combatant').slice(0, 120) || 'Combatant',
    role,
    disposition: normDisposition(raw.disposition, role),
    side: str(raw.side, role === 'pc' ? 'Players' : 'OpFor').slice(0, 60) || 'OpFor',
    initiative:
      raw.initiative === null || raw.initiative === undefined || raw.initiative === ''
        ? null
        : Math.round(num(raw.initiative)),
    initMod: Math.round(num(raw.initMod, 0)),
    tiebreak: Math.round(num(raw.tiebreak, 0)),
    hp: normTrack(raw.hp, 10),
    secondary: normTrack(raw.secondary, 0),
    resolve: Math.max(0, Math.round(num(raw.resolve, 0))),
    conditions: normConditions(raw.conditions),
    notes: str(raw.notes).slice(0, 4000),
    defeated: bool(raw.defeated),
    acted: bool(raw.acted),
    deathSaves: {
      successes: Math.max(0, Math.min(3, Math.round(num(record(raw.deathSaves).successes, 0)))),
      failures: Math.max(0, Math.min(3, Math.round(num(record(raw.deathSaves).failures, 0)))),
    },
    armor: normTrack(raw.armor, 0),
    structure: normTrack(raw.structure, 0),
    heat: Math.max(0, Math.round(num(raw.heat, 0))),
    pilotHits: Math.max(0, Math.min(6, Math.round(num(raw.pilotHits, 0)))),
    ac: Math.max(0, Math.round(num(raw.ac, 0))),
    eac: Math.max(0, Math.round(num(raw.eac, 0))),
    kac: Math.max(0, Math.round(num(raw.kac, 0))),
    shield: Math.max(0, Math.round(num(raw.shield, 0))),
    saves: normSaves(raw.saves),
    dr: Math.max(0, Math.round(num(raw.dr, 0))),
    sr: Math.max(0, Math.round(num(raw.sr, 0))),
    fort: Math.round(num(raw.fort, 0)),
    reflex: Math.round(num(raw.reflex, 0)),
    con: Math.round(num(raw.con, 0)),
    regen: Math.max(0, Math.round(num(raw.regen, 0))),
    cr: Math.max(0, Math.round(num(raw.cr, 0))),
    spellDC: Math.max(0, Math.round(num(raw.spellDC, 0))),
  };
}

export function normalizeEncounter(value: unknown, remapIds = false): Encounter {
  const raw = record(value);
  const system = normSystem(raw.system);
  const now = Date.now();
  const combatants = Array.isArray(raw.combatants)
    ? raw.combatants.map((entry) => normalizeCombatant(entry, remapIds))
    : [];
  const sideRollsRaw = record(raw.sideRolls);
  const sideRolls: Record<string, number | null> = {};
  for (const [key, score] of Object.entries(sideRollsRaw)) {
    sideRolls[key] = score === null ? null : Math.round(num(score, 0));
  }
  const activeId = str(raw.activeId);
  return {
    id: remapIds || !str(raw.id) ? uid('e') : str(raw.id),
    name: str(raw.name, 'Imported encounter').slice(0, 120) || 'Imported encounter',
    system,
    round: Math.max(1, Math.round(num(raw.round, 1))),
    activeId: combatants.some((combatant) => combatant.id === activeId) ? activeId : null,
    combatants,
    sideRolls,
    btOrder: Array.isArray(raw.btOrder) ? raw.btOrder.filter((side): side is string => typeof side === 'string') : [],
    btIndex: Math.max(0, Math.round(num(raw.btIndex, 0))),
    createdAt: num(raw.createdAt, now),
    updatedAt: num(raw.updatedAt, now),
  };
}

/**
 * Accepts either the full app data shape, or a single exported encounter.
 * Imported encounters and combatants always receive fresh ids.
 */
export function normalizeAppData(value: unknown, remapIds = false): AppData | null {
  const raw = record(value);
  let encountersRaw: unknown[];
  if (Array.isArray(raw.encounters)) {
    encountersRaw = raw.encounters;
  } else if (raw.encounter && typeof raw.encounter === 'object') {
    encountersRaw = [raw.encounter];
  } else if (raw.combatants && raw.system) {
    encountersRaw = [raw];
  } else {
    return null;
  }

  const encounters = encountersRaw
    .map((entry) => normalizeEncounter(entry, remapIds))
    .filter((encounter) => encounter.combatants.length > 0 || encounter.name);

  if (encounters.length === 0) return null;

  const settingsRaw = record(raw.settings);
  const activeRaw = str(raw.activeId);
  const activeId = remapIds
    ? encounters[0].id
    : encounters.some((encounter) => encounter.id === activeRaw)
      ? activeRaw
      : encounters[0].id;

  const templates = Array.isArray(raw.templates)
    ? raw.templates
      .map((entry) => normalizeTemplate(entry))
      .filter((template): template is CombatantTemplate => template !== null)
    : [];

  return {
    version: DATA_VERSION,
    encounters,
    activeId,
    templates,
    settings: {
      theme: settingsRaw.theme === 'light' ? 'light' : 'dark',
    },
  };
}
