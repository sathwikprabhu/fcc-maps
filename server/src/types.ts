export interface Marker {
  id: number;
  title: string;
  latitude: number | null;
  longitude: number | null;
  hasCoordinates: boolean;
  url: string;
  category?: string;
  country?: string;
  tags?: string[];
  imageUrl?: string;
}

export interface Settings {
  wpApiUrl: string;
  authEnabled: boolean;
  username?: string;
  password?: string;
  syncIntervalHours: number;
  defaultLat: number;
  defaultLng: number;
  defaultZoom: number;
  enableClustering: boolean;
  logoUrl?: string;
  appTitle?: string;
  faviconUrl?: string;
  baseMapUrl?: string;
}

export interface SyncStats {
  markerCount: number;
  allPostsCount: number;
  invalidPostsCount: number;
  duplicateCoordinatesCount: number;
  jsonFileSize: number;
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
