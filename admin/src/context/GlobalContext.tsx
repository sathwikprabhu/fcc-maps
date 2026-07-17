import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Settings, SyncStatus, LogEntry } from '../types';
import { toast } from 'sonner';

interface GlobalContextProps {
  maps: any[];
  fetchMaps: () => Promise<void>;
  handleDeleteMap: (mapId: string) => Promise<boolean>;
  settings: Settings;
  status: SyncStatus | null;
  logs: LogEntry[];
  taxonomies: { categories: string[]; tags: string[] };
  colors: { categories: Record<string, string>; tags: Record<string, string> };
  setColors: React.Dispatch<React.SetStateAction<{ categories: Record<string, string>; tags: Record<string, string> }>>;
  fetchData: (mapId: string) => Promise<void>;
  fetchColorsAndTaxonomies: (mapId: string) => Promise<void>;
  fetchStatusAndLogs: (mapId: string) => Promise<void>;
  handleSyncNow: (mapId: string) => Promise<void>;
  handleClearLogs: (mapId: string) => Promise<void>;
  loading: boolean;
  syncingLocal: boolean;
}

const GlobalContext = createContext<GlobalContextProps | undefined>(undefined);

export function GlobalProvider({ children }: { children: ReactNode }) {
  const [maps, setMaps] = useState<any[]>([]);
  const [settings, setSettings] = useState<Settings>({
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
    appTitle: 'FCC Maps',
    faviconUrl: '',
    baseMapUrl: '',
    filterTags: [],
    filterCategories: [],
  });
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [taxonomies, setTaxonomies] = useState<{ categories: string[]; tags: string[] }>({ categories: [], tags: [] });
  const [colors, setColors] = useState<{ categories: Record<string, string>; tags: Record<string, string> }>({ categories: {}, tags: {} });
  
  const [loading, setLoading] = useState<boolean>(true);
  const [syncingLocal, setSyncingLocal] = useState<boolean>(false);

  useEffect(() => {
    if (settings) {
      if (settings.appTitle) {
        document.title = settings.appTitle;
      }
      
      // Update favicon link dynamically
      let faviconLink = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!faviconLink) {
        faviconLink = document.createElement('link');
        faviconLink.rel = 'icon';
        document.head.appendChild(faviconLink);
      }
      if (settings.faviconUrl) {
        faviconLink.href = settings.faviconUrl;
      } else {
        faviconLink.href = '/favicon.ico';
      }
    }
  }, [settings.appTitle, settings.faviconUrl]);

  const fetchMaps = async () => {
    try {
      const res = await fetch('/api/maps');
      if (res.ok) {
        setMaps(await res.json());
      }
    } catch (err) {
      console.error('Error fetching maps:', err);
    }
  };

  const handleDeleteMap = async (mapId: string) => {
    if (mapId === 'default') {
      toast.error('Cannot delete default map.');
      return false;
    }
    try {
      const res = await fetch(`/api/maps/${mapId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchMaps();
        toast.success('Map deleted successfully.');
        return true;
      } else {
        const err = await res.json();
        toast.error(`Error: ${err.error || 'Failed to delete map'}`);
        return false;
      }
    } catch (error) {
      toast.error('Network error deleting map.');
      return false;
    }
  };

  const fetchData = async (mapId: string) => {
    setLoading(true);
    try {
      const [settingsRes, statusRes, logsRes] = await Promise.all([
        fetch(`/api/maps/${mapId}/settings`),
        fetch(`/api/maps/${mapId}/status`),
        fetch(`/api/maps/${mapId}/logs`),
      ]);
      if (settingsRes.ok) setSettings(await settingsRes.json());
      if (statusRes.ok) setStatus(await statusRes.json());
      if (logsRes.ok) setLogs(await logsRes.json());
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load map data.');
    } finally {
      setLoading(false);
    }
  };

  const fetchColorsAndTaxonomies = async (mapId: string) => {
    try {
      const [taxRes, colorsRes] = await Promise.all([
        fetch(`/api/maps/${mapId}/taxonomy-list`),
        fetch(`/api/maps/${mapId}/colors`)
      ]);
      if (taxRes.ok) setTaxonomies(await taxRes.json());
      if (colorsRes.ok) setColors(await colorsRes.json());
    } catch (err) {
      console.error('Error fetching colors and taxonomies:', err);
    }
  };

  const fetchStatusAndLogs = async (mapId: string) => {
    try {
      const [statusRes, logsRes] = await Promise.all([
        fetch(`/api/maps/${mapId}/status`),
        fetch(`/api/maps/${mapId}/logs`),
      ]);
      if (statusRes.ok) {
        const newStatus = await statusRes.json();
        if (status?.status === 'syncing' && newStatus.status === 'idle') {
          fetchColorsAndTaxonomies(mapId);
          toast.success('Synchronization completed');
        }
        setStatus(newStatus);
      }
      if (logsRes.ok) setLogs(await logsRes.json());
    } catch (error) {
      console.error('Error refreshing status:', error);
    }
  };

  const handleSyncNow = async (mapId: string) => {
    setSyncingLocal(true);
    try {
      const res = await fetch(`/api/maps/${mapId}/sync`, { method: 'POST' });
      if (res.ok) {
        if (status) setStatus({ ...status, status: 'syncing' });
        setTimeout(() => fetchStatusAndLogs(mapId), 1000);
        toast.info('Synchronization started');
      } else {
        toast.error('Failed to start sync');
      }
    } catch (error) {
      console.error('Error triggering sync:', error);
      toast.error('Network error triggering sync');
    } finally {
      setSyncingLocal(false);
    }
  };

  const handleClearLogs = async (mapId: string) => {
    try {
      const res = await fetch(`/api/maps/${mapId}/logs`, { method: 'DELETE' });
      if (res.ok) { 
        setLogs([]); 
        toast.success('Logs cleared');
      }
    } catch (error) {
      console.error('Error clearing logs:', error);
      toast.error('Failed to clear logs');
    }
  };

  useEffect(() => {
    fetchMaps();
  }, []);

  return (
    <GlobalContext.Provider value={{
      maps, fetchMaps, handleDeleteMap,
      settings, status, logs, taxonomies, colors, setColors,
      fetchData, fetchColorsAndTaxonomies, fetchStatusAndLogs, handleSyncNow, handleClearLogs,
      loading, syncingLocal
    }}>
      {children}
    </GlobalContext.Provider>
  );
}

export function useGlobal() {
  const context = useContext(GlobalContext);
  if (context === undefined) {
    throw new Error('useGlobal must be used within a GlobalProvider');
  }
  return context;
}
