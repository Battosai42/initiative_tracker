import { DATA_VERSION, type AppData, type Encounter } from '../types';
import { createAppData, normalizeAppData } from '../lib/factory';
import { syncSides } from '../lib/battletech';

export const STORAGE_KEY = 'initiative-tracker:v1';

function syncLibrary(data: AppData): AppData {
  return {
    ...data,
    encounters: data.encounters.map((encounter) =>
      encounter.system === 'battletech' ? syncSides(encounter) : encounter,
    ),
  };
}

export function loadData(): AppData {
  if (typeof localStorage === 'undefined') return createAppData();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createAppData();
    const parsed = normalizeAppData(JSON.parse(raw), false);
    if (!parsed) return createAppData();
    return syncLibrary(parsed);
  } catch (error) {
    console.error('Could not load saved encounters:', error);
    return createAppData();
  }
}

export function saveData(data: AppData): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, version: DATA_VERSION }));
  } catch (error) {
    console.error('Could not save encounters:', error);
  }
}

export function clearData(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

function download(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function safeName(value: string): string {
  const name = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return name || 'encounter';
}

export function exportEncounter(encounter: Encounter, settings: AppData['settings']): void {
  download(`${safeName(encounter.name)}.json`, {
    version: DATA_VERSION,
    kind: 'encounter',
    encounters: [encounter],
    activeId: encounter.id,
    settings,
  });
}

export function exportLibrary(data: AppData): void {
  download('initiative-tracker-backup.json', { ...data, kind: 'library' });
}

export function parseImport(text: string): { data?: AppData; error?: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: 'That file is not valid JSON.' };
  }
  const normalized = normalizeAppData(raw, true);
  if (!normalized) {
    return { error: 'No encounters were found in that file.' };
  }
  return { data: syncLibrary(normalized) };
}

export function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'));
    reader.readAsText(file);
  });
}
