export interface Marker {
  id: number;
  title: string;
  latitude: number;
  longitude: number;
  url: string;
  category?: string;
  country?: string;
  imageUrl?: string;
}

export interface Settings {
  wpApiUrl: string;
  authEnabled: boolean;
  username?: string;
  password?: string; // Application password
  syncIntervalHours: number;
  defaultLat: number;
  defaultLng: number;
  defaultZoom: number;
  enableClustering: boolean;
}

export interface SyncStats {
  markerCount: number;
  invalidPostsCount: number;
  duplicateCoordinatesCount: number;
  jsonFileSize: number; // in bytes
}

export interface SyncStatus {
  lastSyncTime: string | null;
  nextSyncTime: string | null;
  status: 'idle' | 'syncing' | 'failed';
  lastError: string | null;
  stats: SyncStats;
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: string;
}
