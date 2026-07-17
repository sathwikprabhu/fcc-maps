import fs from 'fs';
import path from 'path';
import { Settings, SyncStatus, LogEntry, Marker } from '../types';

// Private config — never under a publicly served directory
const CONFIG_DIR = path.join(__dirname, '../../storage/config');
const MAPS_INDEX_PATH = path.join(CONFIG_DIR, 'maps.json');

// Public data — served statically (markers + uploads)
const STORAGE_DIR = path.join(__dirname, '../../storage');

export interface MapInfo {
  id: string;
  name: string;
  createdAt: string;
}

const DEFAULT_SETTINGS: Settings = {
  wpApiUrl: '',
  authEnabled: false,
  username: '',
  password: '',
  syncIntervalHours: 12,
  defaultLat: 45,
  defaultLng: 6,
  defaultZoom: 3,
  enableClustering: true,
  logoUrl: '',
  logoCollapsedUrl: '',
  appTitle: 'FCC Maps',
  faviconUrl: '',
  baseMapUrl: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  filterTags: [],
  filterCategories: [],
};

const DEFAULT_STATUS: SyncStatus = {
  lastSyncTime: null,
  nextSyncTime: null,
  status: 'idle',
  lastError: null,
  stats: {
    markerCount: 0,
    allPostsCount: 0,
    invalidPostsCount: 0,
    duplicateCoordinatesCount: 0,
    jsonFileSize: 0,
  },
};

function ensureDirExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getMapPaths(mapId: string) {
  const mapConfigDir = path.join(CONFIG_DIR, 'maps', mapId);
  const mapStorageDir = path.join(STORAGE_DIR, 'maps', mapId);
  return {
    configDir: mapConfigDir,
    storageDir: mapStorageDir,
    settings: path.join(mapConfigDir, 'settings.json'),
    status: path.join(mapConfigDir, 'status.json'),
    logs: path.join(mapConfigDir, 'logs.json'),
    colors: path.join(mapConfigDir, 'colors.json'),
    markers: path.join(mapStorageDir, 'markers.json'),
  };
}

function migrateExistingConfig() {
  const oldSettingsPath = path.join(CONFIG_DIR, 'settings.json');
  const oldStatusPath = path.join(CONFIG_DIR, 'status.json');
  const oldLogsPath = path.join(CONFIG_DIR, 'logs.json');
  const oldColorsPath = path.join(CONFIG_DIR, 'colors.json');
  const oldMarkersPath = path.join(STORAGE_DIR, 'markers.json');

  if (fs.existsSync(oldSettingsPath)) {
    console.log('[MIGRATION] Migrating existing single-map configuration to default map...');

    // Create maps.json index
    const defaultMaps: MapInfo[] = [{
      id: 'default',
      name: 'Default Map',
      createdAt: new Date().toISOString()
    }];
    if (!fs.existsSync(MAPS_INDEX_PATH)) {
      fs.writeFileSync(MAPS_INDEX_PATH, JSON.stringify(defaultMaps, null, 2), 'utf-8');
    }

    const defaultPaths = getMapPaths('default');
    ensureDirExists(defaultPaths.configDir);
    ensureDirExists(defaultPaths.storageDir);

    // Move files safely
    const safeMove = (src: string, dest: string) => {
      if (fs.existsSync(src)) {
        try {
          fs.renameSync(src, dest);
        } catch {
          fs.copyFileSync(src, dest);
          fs.unlinkSync(src);
        }
      }
    };

    safeMove(oldSettingsPath, defaultPaths.settings);
    safeMove(oldStatusPath, defaultPaths.status);
    safeMove(oldLogsPath, defaultPaths.logs);
    safeMove(oldColorsPath, defaultPaths.colors);
    safeMove(oldMarkersPath, defaultPaths.markers);
    console.log('[MIGRATION] Migration complete.');
  }
}

/**
 * Sanitises a string before it is written to the log file.
 */
function sanitiseLogString(input: string): string {
  return input
    .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '')
    .replace(/\/[^\s"']+\/(opt|home|usr|tmp|var|app)[^\s"']*/g, '[path]')
    .slice(0, 2000);
}

export class StorageService {
  constructor() {
    ensureDirExists(CONFIG_DIR);   // private config dir
    ensureDirExists(STORAGE_DIR);  // public data dir

    // Migrate old configuration if present
    migrateExistingConfig();

    // Initialize maps.json if missing
    if (!fs.existsSync(MAPS_INDEX_PATH)) {
      const defaultMaps: MapInfo[] = [{
        id: 'default',
        name: 'Default Map',
        createdAt: new Date().toISOString()
      }];
      fs.writeFileSync(MAPS_INDEX_PATH, JSON.stringify(defaultMaps, null, 2), 'utf-8');
    }
  }

  getMaps(): MapInfo[] {
    try {
      if (fs.existsSync(MAPS_INDEX_PATH)) {
        const data = fs.readFileSync(MAPS_INDEX_PATH, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to read maps.json:', error);
    }
    return [];
  }

  saveMaps(maps: MapInfo[]): void {
    try {
      fs.writeFileSync(MAPS_INDEX_PATH, JSON.stringify(maps, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save maps.json:', error);
    }
  }

  createMap(id: string, name: string): MapInfo {
    const maps = this.getMaps();
    const cleanId = id.trim().toLowerCase().replace(/[^a-z0-9\-_]/g, '_');
    if (!cleanId) {
      throw new Error('Invalid map ID');
    }

    if (maps.some(m => m.id === cleanId)) {
      throw new Error(`Map with ID '${cleanId}' already exists.`);
    }

    const newMap: MapInfo = {
      id: cleanId,
      name: name.trim() || `Map ${cleanId}`,
      createdAt: new Date().toISOString(),
    };

    maps.push(newMap);
    this.saveMaps(maps);

    const paths = getMapPaths(cleanId);
    ensureDirExists(paths.configDir);
    ensureDirExists(paths.storageDir);

    return newMap;
  }

  deleteMap(id: string): void {
    if (id === 'default') {
      throw new Error('The default map cannot be deleted.');
    }

    const maps = this.getMaps();
    const index = maps.findIndex(m => m.id === id);
    if (index === -1) {
      throw new Error(`Map with ID '${id}' not found.`);
    }

    maps.splice(index, 1);
    this.saveMaps(maps);

    const paths = getMapPaths(id);
    try {
      if (fs.existsSync(paths.configDir)) {
        fs.rmSync(paths.configDir, { recursive: true, force: true });
      }
      if (fs.existsSync(paths.storageDir)) {
        fs.rmSync(paths.storageDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.error(`Failed to clean up directories for map '${id}':`, error);
    }
  }

  updateMap(id: string, name: string): MapInfo {
    const maps = this.getMaps();
    const map = maps.find(m => m.id === id);
    if (!map) {
      throw new Error(`Map with ID '${id}' not found.`);
    }
    map.name = name.trim() || map.name;
    this.saveMaps(maps);
    return map;
  }

  getSettings(mapId: string = 'default'): Settings {
    const paths = getMapPaths(mapId);
    try {
      if (fs.existsSync(paths.settings)) {
        const data = fs.readFileSync(paths.settings, 'utf-8');
        return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
      }
    } catch (error) {
      this.addLog('error', 'Failed to read settings file', String(error), mapId);
    }
    return DEFAULT_SETTINGS;
  }

  saveSettings(settings: Settings, mapId: string = 'default'): void {
    const paths = getMapPaths(mapId);
    try {
      ensureDirExists(paths.configDir);
      fs.writeFileSync(paths.settings, JSON.stringify(settings, null, 2), 'utf-8');
    } catch (error) {
      this.addLog('error', 'Failed to save settings file', String(error), mapId);
    }
  }

  getStatus(mapId: string = 'default'): SyncStatus {
    const paths = getMapPaths(mapId);
    try {
      if (fs.existsSync(paths.status)) {
        const data = fs.readFileSync(paths.status, 'utf-8');
        return { ...DEFAULT_STATUS, ...JSON.parse(data) };
      }
    } catch (error) {
      this.addLog('error', 'Failed to read status file', String(error), mapId);
    }
    return DEFAULT_STATUS;
  }

  saveStatus(status: SyncStatus, mapId: string = 'default'): void {
    const paths = getMapPaths(mapId);
    try {
      ensureDirExists(paths.configDir);
      fs.writeFileSync(paths.status, JSON.stringify(status, null, 2), 'utf-8');
    } catch (error) {
      this.addLog('error', 'Failed to save status file', String(error), mapId);
    }
  }

  getLogs(mapId: string = 'default'): LogEntry[] {
    const paths = getMapPaths(mapId);
    try {
      if (fs.existsSync(paths.logs)) {
        const data = fs.readFileSync(paths.logs, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      // Avoid infinite logging loop
    }
    return [];
  }

  addLog(level: 'info' | 'warn' | 'error', message: string, details?: string, mapId: string = 'default'): void {
    const paths = getMapPaths(mapId);
    try {
      const logs = this.getLogs(mapId);
      const newEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message: sanitiseLogString(message),
        details: details !== undefined ? sanitiseLogString(details) : undefined,
      };
      logs.unshift(newEntry);

      ensureDirExists(paths.configDir);
      const trimmedLogs = logs.slice(0, 500);
      fs.writeFileSync(paths.logs, JSON.stringify(trimmedLogs, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to write logs:', error);
    }
  }

  clearLogs(mapId: string = 'default'): void {
    const paths = getMapPaths(mapId);
    try {
      ensureDirExists(paths.configDir);
      fs.writeFileSync(paths.logs, JSON.stringify([], null, 2), 'utf-8');
    } catch (error) {
      this.addLog('error', 'Failed to clear logs file', String(error), mapId);
    }
  }

  saveMarkers(markers: Marker[], mapId: string = 'default'): number {
    const paths = getMapPaths(mapId);
    try {
      ensureDirExists(paths.storageDir);
      const jsonContent = JSON.stringify(markers, null, 2);
      fs.writeFileSync(paths.markers, jsonContent, 'utf-8');
      return Buffer.byteLength(jsonContent, 'utf-8');
    } catch (error) {
      this.addLog('error', 'Failed to save markers', String(error), mapId);
      throw error;
    }
  }

  getMarkersSize(mapId: string = 'default'): number {
    const paths = getMapPaths(mapId);
    try {
      if (fs.existsSync(paths.markers)) {
        return fs.statSync(paths.markers).size;
      }
    } catch (error) {
      // silent
    }
    return 0;
  }

  getColors(mapId: string = 'default'): { categories: Record<string, string>; tags: Record<string, string> } {
    const paths = getMapPaths(mapId);
    try {
      if (fs.existsSync(paths.colors)) {
        return JSON.parse(fs.readFileSync(paths.colors, 'utf-8'));
      }
    } catch (error) {
      this.addLog('error', 'Failed to read colors file', String(error), mapId);
    }
    return { categories: {}, tags: {} };
  }

  saveColors(colors: { categories: Record<string, string>; tags: Record<string, string> }, mapId: string = 'default'): void {
    const paths = getMapPaths(mapId);
    try {
      ensureDirExists(paths.configDir);
      fs.writeFileSync(paths.colors, JSON.stringify(colors, null, 2), 'utf-8');
    } catch (error) {
      this.addLog('error', 'Failed to save colors file', String(error), mapId);
      throw error;
    }
  }

  getParsedMarkers(mapId: string = 'default'): Marker[] {
    const paths = getMapPaths(mapId);
    try {
      if (fs.existsSync(paths.markers)) {
        return JSON.parse(fs.readFileSync(paths.markers, 'utf-8'));
      }
    } catch (error) {
      // silent
    }
    return [];
  }
}

export const storage = new StorageService();
