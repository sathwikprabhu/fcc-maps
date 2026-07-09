import fs from 'fs';
import path from 'path';
import { Settings, SyncStatus, LogEntry, Marker } from '../types';

const STORAGE_DIR = path.join(__dirname, '../../storage');
const SETTINGS_PATH = path.join(STORAGE_DIR, 'settings.json');
const STATUS_PATH = path.join(STORAGE_DIR, 'status.json');
const LOGS_PATH = path.join(STORAGE_DIR, 'logs.json');

const MARKERS_PATH = path.join(STORAGE_DIR, 'markers.json');

const DEFAULT_SETTINGS: Settings = {
  wpApiUrl: '',
  authEnabled: false,
  username: '',
  password: '',
  syncIntervalHours: 12,
  defaultLat: 46.23307,
  defaultLng: 6.05551,
  defaultZoom: 8,
  enableClustering: true,
  logoUrl: '',
  appTitle: 'FCC Maps',
  faviconUrl: '',
  baseMapUrl: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
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

export class StorageService {
  constructor() {
    ensureDirExists(STORAGE_DIR);
  }

  getSettings(): Settings {
    try {
      if (fs.existsSync(SETTINGS_PATH)) {
        const data = fs.readFileSync(SETTINGS_PATH, 'utf-8');
        return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
      }
    } catch (error) {
      this.addLog('error', 'Failed to read settings file', String(error));
    }
    return DEFAULT_SETTINGS;
  }

  saveSettings(settings: Settings): void {
    try {
      fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
    } catch (error) {
      this.addLog('error', 'Failed to save settings file', String(error));
    }
  }

  getStatus(): SyncStatus {
    try {
      if (fs.existsSync(STATUS_PATH)) {
        const data = fs.readFileSync(STATUS_PATH, 'utf-8');
        return { ...DEFAULT_STATUS, ...JSON.parse(data) };
      }
    } catch (error) {
      this.addLog('error', 'Failed to read status file', String(error));
    }
    return DEFAULT_STATUS;
  }

  saveStatus(status: SyncStatus): void {
    try {
      fs.writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2), 'utf-8');
    } catch (error) {
      this.addLog('error', 'Failed to save status file', String(error));
    }
  }

  getLogs(): LogEntry[] {
    try {
      if (fs.existsSync(LOGS_PATH)) {
        const data = fs.readFileSync(LOGS_PATH, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      // Avoid infinite loop logging error here
    }
    return [];
  }

  addLog(level: 'info' | 'warn' | 'error', message: string, details?: string): void {
    try {
      const logs = this.getLogs();
      const newEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        details,
      };
      logs.unshift(newEntry); // Newest logs first
      
      // Limit to last 500 entries
      const trimmedLogs = logs.slice(0, 500);
      fs.writeFileSync(LOGS_PATH, JSON.stringify(trimmedLogs, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to write logs:', error);
    }
  }

  clearLogs(): void {
    try {
      fs.writeFileSync(LOGS_PATH, JSON.stringify([], null, 2), 'utf-8');
    } catch (error) {
      this.addLog('error', 'Failed to clear logs file', String(error));
    }
  }

  saveMarkers(markers: Marker[]): number {
    try {
      const jsonContent = JSON.stringify(markers, null, 2);
      fs.writeFileSync(MARKERS_PATH, jsonContent, 'utf-8');
      return Buffer.byteLength(jsonContent, 'utf-8');
    } catch (error) {
      this.addLog('error', 'Failed to save markers.json', String(error));
      throw error;
    }
  }

  getMarkersSize(): number {
    try {
      if (fs.existsSync(MARKERS_PATH)) {
        return fs.statSync(MARKERS_PATH).size;
      }
    } catch (error) {
      // Silent
    }
    return 0;
  }

  getColors(): { categories: Record<string, string>; tags: Record<string, string> } {
    const COLORS_PATH = path.join(STORAGE_DIR, 'colors.json');
    try {
      if (fs.existsSync(COLORS_PATH)) {
        return JSON.parse(fs.readFileSync(COLORS_PATH, 'utf-8'));
      }
    } catch (error) {
      this.addLog('error', 'Failed to read colors.json', String(error));
    }
    return { categories: {}, tags: {} };
  }

  saveColors(colors: { categories: Record<string, string>; tags: Record<string, string> }): void {
    const COLORS_PATH = path.join(STORAGE_DIR, 'colors.json');
    try {
      fs.writeFileSync(COLORS_PATH, JSON.stringify(colors, null, 2), 'utf-8');
    } catch (error) {
      this.addLog('error', 'Failed to save colors.json', String(error));
      throw error;
    }
  }

  getParsedMarkers(): Marker[] {
    try {
      if (fs.existsSync(MARKERS_PATH)) {
        return JSON.parse(fs.readFileSync(MARKERS_PATH, 'utf-8'));
      }
    } catch (error) {
      // silent
    }
    return [];
  }
}

export const storage = new StorageService();
