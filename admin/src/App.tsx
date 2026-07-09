import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  MapPin,
  RefreshCw,
  FileText,
  Database,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Trash2,
  Lock,
  Layers,
  Map as MapIcon,
  Sliders,
  Download,
} from 'lucide-react';
import type { Settings, SyncStatus, LogEntry } from './types';

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const BASE_MAPS = [
  {
    name: "CartoDB Voyager (Default)",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
  },
  {
    name: "CartoDB Positron (Light Minimal)",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
  },
  {
    name: "CartoDB Dark Matter (Dark Mode)",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
  },
  {
    name: "OpenStreetMap Standard (Detailed)",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  },
  {
    name: "Esri World Imagery (Satellite)",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
  },
  {
    name: "Esri World Street Map (Detailed Roads)",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
  },
  {
    name: "OpenTopoMap (Topographical)",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
  },
  {
    name: "MapTiler Landscape (Requires API Key)",
    url: "https://api.maptiler.com/maps/landscape/{z}/{x}/{y}.png?key=YOUR_API_KEY"
  }
];

function ColorPicker({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const HUES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
  
  const hslToHex = (h: number, s: number, l: number) => {
    l /= 100;
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      const hex = Math.round(255 * color).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  const presetColors = HUES.map(h => hslToHex(h, 100, 35));

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 py-1.5 border rounded-md hover:bg-muted/50 transition-colors w-full justify-between"
      >
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full border shadow-sm"
            style={{ backgroundColor: value }}
          />
          <span className="text-xs text-muted-foreground font-mono uppercase">{value}</span>
        </div>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 z-50 p-3 bg-popover text-popover-foreground border rounded-md shadow-md w-48">
          <div className="grid grid-cols-4 gap-2">
            {presetColors.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => {
                  onChange(color);
                  setIsOpen(false);
                }}
                className={`w-6 h-6 rounded-full border transition-all hover:scale-110 active:scale-95 ${
                  value.toLowerCase() === color.toLowerCase()
                    ? 'ring-2 ring-offset-2 ring-foreground border-foreground scale-110'
                    : 'border-muted hover:border-foreground/50'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const getTabFromPath = (pathname: string) => {
    const cleanPath = pathname.replace(/\/$/, '');
    if (cleanPath === '/embed') return 'embed';
    if (cleanPath === '/colors') return 'colors';
    if (cleanPath === '/settings') return 'settings';
    return 'dashboard';
  };

  const activeTab = getTabFromPath(location.pathname);

  const setActiveTab = (tab: string) => {
    if (tab === 'dashboard') {
      navigate('/');
    } else {
      navigate(`/${tab}`);
    }
  };
  const [settings, setSettings] = useState<Settings>({
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
  });
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncingLocal, setSyncingLocal] = useState<boolean>(false);
  const [expandedLogIdx, setExpandedLogIdx] = useState<number | null>(null);

  const [formSettings, setFormSettings] = useState<Settings>({ ...settings });
  const [saveStatus, setSaveStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  const [embedLat, setEmbedLat] = useState<string>('46.23307');
  const [embedLng, setEmbedLng] = useState<string>('6.05551');
  const [embedZoom, setEmbedZoom] = useState<string>('8');
  const [embedUrl, setEmbedUrl] = useState<string>('');

  const [taxonomies, setTaxonomies] = useState<{ categories: string[]; tags: string[] }>({ categories: [], tags: [] });
  const [colors, setColors] = useState<{ categories: Record<string, string>; tags: Record<string, string> }>({ categories: {}, tags: {} });
  const [colorsSaveStatus, setColorsSaveStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [activeSection, setActiveSection] = useState<string>('branding');

  useEffect(() => { 
    fetchData(); 
    fetchColorsAndTaxonomies();
  }, []);

  useEffect(() => {
    if (settings) {
      setFormSettings({ ...settings });
      setEmbedLat(settings.defaultLat.toString());
      setEmbedLng(settings.defaultLng.toString());
      setEmbedZoom(settings.defaultZoom.toString());
    }
  }, [settings]);

  useEffect(() => {
    const origin = window.location.origin;
    setEmbedUrl(`${origin}/embed/?lat=${embedLat}&lng=${embedLng}&zoom=${embedZoom}`);
  }, [embedLat, embedLng, embedZoom]);

  useEffect(() => {
    if (settings.appTitle) {
      document.title = settings.appTitle;
    }
  }, [settings.appTitle]);

  useEffect(() => {
    if (settings.faviconUrl) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = settings.faviconUrl;
    }
  }, [settings.faviconUrl]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchStatusAndLogs();
    }, status?.status === 'syncing' ? 2000 : 10000);
    return () => clearInterval(interval);
  }, [status]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [settingsRes, statusRes, logsRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/status'),
        fetch('/api/logs'),
      ]);
      if (settingsRes.ok) setSettings(await settingsRes.json());
      if (statusRes.ok) setStatus(await statusRes.json());
      if (logsRes.ok) setLogs(await logsRes.json());
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchColorsAndTaxonomies = async () => {
    try {
      const [taxRes, colorsRes] = await Promise.all([
        fetch('/api/taxonomy-list'),
        fetch('/api/colors')
      ]);
      if (taxRes.ok) setTaxonomies(await taxRes.json());
      if (colorsRes.ok) setColors(await colorsRes.json());
    } catch (err) {
      console.error('Error fetching colors and taxonomies:', err);
    }
  };

  const fetchStatusAndLogs = async () => {
    try {
      const [statusRes, logsRes] = await Promise.all([
        fetch('/api/status'),
        fetch('/api/logs'),
      ]);
      if (statusRes.ok) {
        const newStatus = await statusRes.json();
        if (status?.status === 'syncing' && newStatus.status === 'idle') {
          fetchColorsAndTaxonomies();
        }
        setStatus(newStatus);
      }
      if (logsRes.ok) setLogs(await logsRes.json());
    } catch (error) {
      console.error('Error refreshing status:', error);
    }
  };

  const handleSyncNow = async () => {
    setSyncingLocal(true);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      if (res.ok) {
        if (status) setStatus({ ...status, status: 'syncing' });
        setTimeout(fetchStatusAndLogs, 1000);
      }
    } catch (error) {
      console.error('Error triggering sync:', error);
    } finally {
      setSyncingLocal(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formSettings),
      });
      const data = await res.json();
      if (res.ok) {
        setSettings(formSettings);
        setSaveStatus({ success: true, message: 'Configuration saved successfully.' });
        fetchStatusAndLogs();
      } else {
        setSaveStatus({ success: false, message: data.error || 'Failed to save settings.' });
      }
    } catch {
      setSaveStatus({ success: false, message: 'Network error saving settings.' });
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        const response = await fetch('/api/upload-logo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, base64 }),
        });
        if (response.ok) {
          const data = await response.json();
          setFormSettings(prev => ({ ...prev, logoUrl: data.url }));
        } else {
          console.error('Failed to upload logo image');
        }
      } catch (err) {
        console.error('Error uploading logo:', err);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        const response = await fetch('/api/upload-logo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, base64 }),
        });
        if (response.ok) {
          const data = await response.json();
          setFormSettings(prev => ({ ...prev, faviconUrl: data.url }));
        } else {
          console.error('Failed to upload favicon image');
        }
      } catch (err) {
        console.error('Error uploading favicon:', err);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveColors = async () => {
    setColorsSaveStatus(null);
    try {
      const res = await fetch('/api/colors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(colors),
      });
      if (res.ok) {
        setColorsSaveStatus({ success: true, message: 'Taxonomy colors saved successfully.' });
      } else {
        const data = await res.json();
        setColorsSaveStatus({ success: false, message: data.error || 'Failed to save colors.' });
      }
    } catch {
      setColorsSaveStatus({ success: false, message: 'Network error saving colors configuration.' });
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const separator = formSettings.wpApiUrl.includes('?') ? '&' : '?';
      const url = `${formSettings.wpApiUrl}${separator}per_page=1&_embed=1`;
      const headers: Record<string, string> = {};
      if (formSettings.authEnabled && formSettings.username && formSettings.password) {
        headers['Authorization'] = `Basic ${btoa(`${formSettings.username}:${formSettings.password}`)}`;
      }
      const response = await fetch(url, { headers });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setTestResult({ success: true, message: `Connected. Found posts. Example: "${data[0]?.title?.rendered || 'No posts'}"` });
        } else {
          setTestResult({ success: false, message: 'Reachable but response is not a valid JSON array.' });
        }
      } else {
        setTestResult({ success: false, message: `Error ${response.status}: ${response.statusText}` });
      }
    } catch (error) {
      setTestResult({ success: false, message: `Connection failed: ${String(error)}` });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleClearLogs = async () => {
    if (confirm('Are you sure you want to clear all scheduler logs?')) {
      try {
        const res = await fetch('/api/logs', { method: 'DELETE' });
        if (res.ok) { setLogs([]); setExpandedLogIdx(null); }
      } catch (error) {
        console.error('Error clearing logs:', error);
      }
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString() : 'Never';

  const logLevelVariant = (level: string): 'default' | 'destructive' | 'secondary' | 'outline' => {
    if (level === 'error') return 'destructive';
    if (level === 'warn') return 'secondary';
    return 'outline';
  };

  if (loading && !status) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* Header */}
      <header className="border-b sticky top-0 z-40 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          <a href="/admin/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="h-12 py-1 object-contain" />
            ) : (
              <>
                <MapPin className="h-5 w-5" />
                <span className="font-semibold text-sm">{settings.appTitle || 'FCC Maps'}</span>
              </>
            )}
          </a>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="embed">Embed</TabsTrigger>
              <TabsTrigger value="colors">Colors</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Syncing alert */}
        {status?.status === 'syncing' && (
          <Alert className="mb-6">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <AlertTitle>Sync in progress</AlertTitle>
            <AlertDescription>
              Downloading data from WordPress and updating markers.json…
            </AlertDescription>
          </Alert>
        )}

        {/* Failed alert */}
        {status?.status === 'failed' && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Last sync failed</AlertTitle>
            <AlertDescription>{status.lastError}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab}>

          {/* ── Dashboard ── */}
          <TabsContent value="dashboard" className="space-y-6">

            {/* KPI grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5" /> Active Markers
                  </CardDescription>
                  <CardTitle className="text-3xl">{status?.stats.markerCount ?? 0}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Clean parsed posts</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" /> Cache File Size
                  </CardDescription>
                  <CardTitle className="text-3xl">{formatSize(status?.stats.jsonFileSize ?? 0)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">markers.json footprint</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Last Sync
                  </CardDescription>
                  <CardTitle className="text-lg truncate">
                    {status?.lastSyncTime ? new Date(status.lastSyncTime).toLocaleTimeString() : 'Never'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {status?.lastSyncTime ? new Date(status.lastSyncTime).toLocaleDateString() : 'No history'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Next Sync
                  </CardDescription>
                  <CardTitle className="text-lg truncate">
                    {status?.nextSyncTime ? new Date(status.nextSyncTime).toLocaleTimeString() : 'Never'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {status?.nextSyncTime ? new Date(status.nextSyncTime).toLocaleDateString() : 'Awaiting config'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Split: metrics + map */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sliders className="h-4 w-4" /> Ingestion Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Valid markers</span>
                    <span className="font-medium">{status?.stats.markerCount ?? 0}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total posts</span>
                    <span className="font-medium">{status?.stats.allPostsCount ?? 0}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Missing coords</span>
                    <span className="font-medium">{status?.stats.invalidPostsCount ?? 0}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Duplicates</span>
                    <span className="font-medium">{status?.stats.duplicateCoordinatesCount ?? 0}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Clustering</span>
                    <span className="font-medium">{settings.enableClustering ? 'On' : 'Off'}</span>
                  </div>
                  <Button
                    className="w-full mt-2"
                    onClick={handleSyncNow}
                    disabled={status?.status === 'syncing' || syncingLocal}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${status?.status === 'syncing' || syncingLocal ? 'animate-spin' : ''}`} />
                    Sync Now
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    asChild
                  >
                    <a href="/api/export-csv" download>
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </a>
                  </Button>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2 flex flex-col h-[360px]">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MapIcon className="h-4 w-4" /> Map Preview
                  </CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <a href="/embed" target="_blank" className="flex items-center gap-1">
                      Full screen <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </CardHeader>
                <CardContent className="flex-1 p-4 pt-0">
                  <div className="w-full h-full rounded-md overflow-hidden border">
                    <iframe
                      key={status?.lastSyncTime}
                      src="/embed"
                      className="w-full h-full border-0"
                      title="Embed Preview"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent logs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4" /> Recent Logs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.slice(0, 5).map((log, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={logLevelVariant(log.level)}>{log.level}</Badge>
                        </TableCell>
                        <TableCell>{log.message}</TableCell>
                      </TableRow>
                    ))}
                    {logs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                          No log entries yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

          </TabsContent>


          {/* ── Colors ── */}
          <TabsContent value="colors" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Taxonomy Color Configuration</CardTitle>
                <CardDescription>
                  Configure custom colors for map markers (by Category) and map popup badges (by Tag).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  
                  {/* Categories */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-primary" /> Map Pointer Colors (by Category)
                    </h3>
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead className="w-32">Color</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {taxonomies.categories.map(cat => (
                            <TableRow key={cat}>
                              <TableCell className="font-medium">{cat}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <ColorPicker
                                    value={colors.categories[cat] || '#2563eb'}
                                    onChange={(color) => setColors(prev => ({
                                      ...prev,
                                      categories: { ...prev.categories, [cat]: color }
                                    }))}
                                  />
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {taxonomies.categories.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                                No categories found. Please sync your data first.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground" /> Popup Badge Colors (by Tag)
                    </h3>
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tag</TableHead>
                            <TableHead className="w-32">Color</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {taxonomies.tags.map(tag => (
                            <TableRow key={tag}>
                              <TableCell className="font-medium">{tag}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <ColorPicker
                                    value={colors.tags[tag] || '#71717a'}
                                    onChange={(color) => setColors(prev => ({
                                      ...prev,
                                      tags: { ...prev.tags, [tag]: color }
                                    }))}
                                  />
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {taxonomies.tags.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                                No tags found. Please sync your data first.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                </div>

                {colorsSaveStatus && (
                  <Alert variant={colorsSaveStatus.success ? 'default' : 'destructive'}>
                    <AlertTitle>{colorsSaveStatus.success ? 'Success' : 'Error'}</AlertTitle>
                    <AlertDescription>{colorsSaveStatus.message}</AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-end pt-4 border-t">
                  <Button onClick={handleSaveColors}>Save Colors Configuration</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Settings ── */}
          <TabsContent value="settings">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
              
              {/* Settings Sidebar Nav */}
              <div className="sticky top-20 flex flex-col gap-1 md:border-r md:pr-4 md:h-[calc(100vh-200px)]">
                <h3 className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Settings Sections
                </h3>
                <a 
                  href="#branding" 
                  onClick={() => setActiveSection('branding')}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                    activeSection === 'branding' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                >
                  Branding
                </a>
                <a 
                  href="#wp-api" 
                  onClick={() => setActiveSection('wp-api')}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                    activeSection === 'wp-api' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                >
                  WordPress REST API
                </a>
                <a 
                  href="#map-config" 
                  onClick={() => setActiveSection('map-config')}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                    activeSection === 'map-config' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                >
                  Map Configuration
                </a>
                <a 
                  href="#scheduler" 
                  onClick={() => setActiveSection('scheduler')}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                    activeSection === 'scheduler' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                >
                  Map & Scheduler
                </a>
                <a 
                  href="#sync-logs" 
                  onClick={() => setActiveSection('sync-logs')}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                    activeSection === 'sync-logs' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                >
                  Sync & Logs
                </a>
              </div>

              {/* Settings Column */}
              <div className="md:col-span-3 space-y-6">
                <form onSubmit={handleSaveSettings} className="space-y-6">
                
                {/* Branding Card */}
                <div id="branding" className="scroll-mt-20">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Branding</CardTitle>
                      <CardDescription>Configure the application title, logo, and favicon.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* App Title */}
                      <div className="space-y-2">
                        <Label htmlFor="appTitle">Application Title</Label>
                        <Input
                          id="appTitle"
                          type="text"
                          placeholder="FCC Maps"
                          value={formSettings.appTitle || ''}
                          onChange={(e) => setFormSettings(prev => ({ ...prev, appTitle: e.target.value }))}
                        />
                      </div>

                      <Separator />

                      {/* Logo Upload */}
                      <div className="space-y-3">
                        <Label>Header Logo</Label>
                        <div className="flex items-center gap-4">
                          {formSettings.logoUrl ? (
                            <div className="border p-2 bg-muted flex items-center justify-center h-16 w-32">
                              <img src={formSettings.logoUrl} alt="Logo Preview" className="h-12 py-1 px-1 object-contain" />
                            </div>
                          ) : (
                            <div className="border p-2 bg-muted flex items-center justify-center h-16 w-32 text-xs text-muted-foreground">
                              No Logo
                            </div>
                          )}
                          <div className="flex-1 space-y-2">
                            <Input
                              id="logoUpload"
                              type="file"
                              accept="image/*"
                              onChange={handleLogoUpload}
                              className="cursor-pointer"
                            />
                          </div>
                          {formSettings.logoUrl && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setFormSettings(prev => ({ ...prev, logoUrl: '' }))}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>

                      <Separator />

                      {/* Favicon Upload */}
                      <div className="space-y-3">
                        <Label>Browser Favicon</Label>
                        <div className="flex items-center gap-4">
                          {formSettings.faviconUrl ? (
                            <div className="border p-2 bg-muted flex items-center justify-center h-12 w-12">
                              <img src={formSettings.faviconUrl} alt="Favicon Preview" className="h-8 w-8 object-contain" />
                            </div>
                          ) : (
                            <div className="border p-2 bg-muted flex items-center justify-center h-12 w-12 text-xs text-muted-foreground">
                              None
                            </div>
                          )}
                          <div className="flex-1 space-y-2">
                            <Input
                              id="faviconUpload"
                              type="file"
                              accept="image/*"
                              onChange={handleFaviconUpload}
                              className="cursor-pointer"
                            />
                          </div>
                          {formSettings.faviconUrl && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setFormSettings(prev => ({ ...prev, faviconUrl: '' }))}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>

                    </CardContent>
                  </Card>
                </div>

                {/* WordPress REST API Card */}
                <div id="wp-api" className="scroll-mt-20">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">WordPress REST API</CardTitle>
                      <CardDescription>Configure the posts endpoint, authentication, and test connectivity.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="wpApiUrl">Posts endpoint URL</Label>
                        <Input
                          id="wpApiUrl"
                          type="url"
                          required
                          placeholder="https://example.com/wp-json/wp/v2/posts"
                          value={formSettings.wpApiUrl}
                          onChange={(e) => setFormSettings({ ...formSettings, wpApiUrl: e.target.value })}
                        />
                        <p className="text-sm text-muted-foreground">Must point to the standard WP posts endpoint.</p>
                      </div>

                      <Separator />

                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="authEnabled"
                          checked={formSettings.authEnabled}
                          onCheckedChange={(checked) => setFormSettings({ ...formSettings, authEnabled: checked === true })}
                        />
                        <Label htmlFor="authEnabled" className="flex items-center gap-1.5 cursor-pointer">
                          <Lock className="h-3.5 w-3.5" /> Enable Basic Authentication
                        </Label>
                      </div>

                      {formSettings.authEnabled && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-6">
                          <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <Input
                              id="username"
                              type="text"
                              required={formSettings.authEnabled}
                              placeholder="admin"
                              value={formSettings.username || ''}
                              onChange={(e) => setFormSettings({ ...formSettings, username: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="password">Application Password</Label>
                            <Input
                              id="password"
                              type="password"
                              required={formSettings.authEnabled}
                              placeholder="xxxx xxxx xxxx xxxx"
                              value={formSettings.password || ''}
                              onChange={(e) => setFormSettings({ ...formSettings, password: e.target.value })}
                            />
                          </div>
                        </div>
                      )}

                      <Separator />

                      {/* Connection Test integrated here */}
                      <div className="pt-2 space-y-4">
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={handleTestConnection}
                          disabled={testingConnection || !formSettings.wpApiUrl}
                        >
                          {testingConnection ? 'Testing…' : 'Test connection'}
                        </Button>
                        {testResult && (
                          <Alert variant={testResult.success ? 'default' : 'destructive'}>
                            <AlertTitle>{testResult.success ? 'Connected' : 'Failed'}</AlertTitle>
                            <AlertDescription>{testResult.message}</AlertDescription>
                          </Alert>
                        )}
                      </div>

                    </CardContent>
                  </Card>
                </div>

                {/* Map Configuration Card */}
                <div id="map-config" className="scroll-mt-20">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Map Configuration</CardTitle>
                      <CardDescription>Select the base map style and preview it below.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="baseMapUrl">Base Map Style</Label>
                        <select
                          id="baseMapUrl"
                          value={BASE_MAPS.some(m => m.url === formSettings.baseMapUrl) ? formSettings.baseMapUrl : "custom"}
                          onChange={(e) => {
                            if (e.target.value !== "custom") {
                              setFormSettings(prev => ({ ...prev, baseMapUrl: e.target.value }));
                            }
                          }}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          {BASE_MAPS.map(map => (
                            <option key={map.url} value={map.url}>{map.name}</option>
                          ))}
                          {!BASE_MAPS.some(m => m.url === formSettings.baseMapUrl) && (
                            <option value="custom">Custom URL / Template</option>
                          )}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="baseMapUrlCustom">Base Map URL Template</Label>
                        <Input
                          id="baseMapUrlCustom"
                          type="text"
                          value={formSettings.baseMapUrl || ''}
                          onChange={(e) => setFormSettings(prev => ({ ...prev, baseMapUrl: e.target.value }))}
                          placeholder="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <p className="text-xs text-muted-foreground">
                          Custom XYZ or MapTiler raster tile URL template. If using MapTiler, make sure to replace <code>YOUR_API_KEY</code> with your MapTiler token.
                        </p>
                      </div>
                      
                      <div className="h-[200px] border rounded overflow-hidden">
                        <iframe
                          key={formSettings.baseMapUrl}
                          src={`/embed/?lat=${formSettings.defaultLat}&lng=${formSettings.defaultLng}&zoom=5&preview=1&baseMapUrl=${encodeURIComponent(formSettings.baseMapUrl || '')}`}
                          className="w-full h-full border-0"
                          title="Base Map Preview"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Map & Scheduler Card */}
                <div id="scheduler" className="scroll-mt-20">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Map & Scheduler</CardTitle>
                      <CardDescription>Default viewport and sync frequency.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="defaultLat">Latitude</Label>
                          <Input
                            id="defaultLat"
                            type="number"
                            step="any"
                            required
                            value={formSettings.defaultLat}
                            onChange={(e) => setFormSettings({ ...formSettings, defaultLat: parseFloat(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="defaultLng">Longitude</Label>
                          <Input
                            id="defaultLng"
                            type="number"
                            step="any"
                            required
                            value={formSettings.defaultLng}
                            onChange={(e) => setFormSettings({ ...formSettings, defaultLng: parseFloat(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="defaultZoom">Zoom</Label>
                          <Input
                            id="defaultZoom"
                            type="number"
                            required
                            min="1"
                            max="18"
                            value={formSettings.defaultZoom}
                            onChange={(e) => setFormSettings({ ...formSettings, defaultZoom: parseInt(e.target.value, 10) })}
                          />
                        </div>
                      </div>

                      <Separator />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="syncIntervalHours">Sync interval (hours)</Label>
                          <Input
                            id="syncIntervalHours"
                            type="number"
                            required
                            min="1"
                            value={formSettings.syncIntervalHours}
                            onChange={(e) => setFormSettings({ ...formSettings, syncIntervalHours: parseInt(e.target.value, 10) })}
                          />
                          <p className="text-sm text-muted-foreground">Controls how often the background scheduler runs.</p>
                        </div>

                        <div className="flex flex-col justify-center gap-2">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="enableClustering"
                              checked={formSettings.enableClustering}
                              onCheckedChange={(checked) => setFormSettings({ ...formSettings, enableClustering: checked === true })}
                            />
                            <Label htmlFor="enableClustering" className="flex items-center gap-1.5 cursor-pointer">
                              <Layers className="h-3.5 w-3.5" /> Enable marker clustering
                            </Label>
                          </div>
                          <p className="text-sm text-muted-foreground pl-6">Groups nearby markers. When off, duplicates are filtered.</p>
                        </div>
                      </div>

                      {saveStatus && (
                        <Alert variant={saveStatus.success ? 'default' : 'destructive'}>
                          <AlertTitle>{saveStatus.success ? 'Saved' : 'Error'}</AlertTitle>
                          <AlertDescription>{saveStatus.message}</AlertDescription>
                        </Alert>
                      )}

                      <div className="flex justify-end">
                        <Button type="submit">Save settings</Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

              </form>

              {/* Sync & Logs inside Settings */}
              <div id="sync-logs" className="space-y-6 scroll-mt-20">
                <Card>
                  <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-semibold">Manual Sync</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Triggers a WordPress crawl. The existing markers.json will not be overwritten if the API is unreachable.
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Status: <span className="font-medium text-foreground">{status?.status ?? '—'}</span>
                        {' · '}Last sync: <span className="font-medium text-foreground">{formatDate(status?.lastSyncTime ?? null)}</span>
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={handleSyncNow}
                      disabled={status?.status === 'syncing' || syncingLocal}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${status?.status === 'syncing' || syncingLocal ? 'animate-spin' : ''}`} />
                      Sync Now
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base">System Logs</CardTitle>
                      <CardDescription>Latest 500 actions logged by the backend scheduler.</CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleClearLogs}
                      disabled={logs.length === 0}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear logs
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8"></TableHead>
                          <TableHead>Timestamp</TableHead>
                          <TableHead>Level</TableHead>
                          <TableHead>Message</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map((log, idx) => (
                          <React.Fragment key={idx}>
                            <TableRow
                              onClick={() => setExpandedLogIdx(expandedLogIdx === idx ? null : idx)}
                              className="cursor-pointer"
                            >
                              <TableCell>
                                {log.details
                                  ? expandedLogIdx === idx
                                    ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  : null}
                              </TableCell>
                              <TableCell className="text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</TableCell>
                              <TableCell>
                                <Badge variant={logLevelVariant(log.level)}>{log.level}</Badge>
                              </TableCell>
                              <TableCell>{log.message}</TableCell>
                            </TableRow>
                            {expandedLogIdx === idx && log.details && (
                              <TableRow>
                                <TableCell />
                                <TableCell colSpan={3}>
                                  <pre className="text-xs text-muted-foreground bg-muted rounded p-3 whitespace-pre-wrap">
                                    {log.details}
                                  </pre>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        ))}
                        {logs.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                              No logs recorded yet.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>

            </div>
          </div>
        </TabsContent>

          {/* ── Embed ── */}
          <TabsContent value="embed">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Viewport</CardTitle>
                  <CardDescription>Override coordinates for this embed snippet.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="embedLat">Latitude</Label>
                    <Input id="embedLat" type="number" step="any" value={embedLat} onChange={(e) => setEmbedLat(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="embedLng">Longitude</Label>
                    <Input id="embedLng" type="number" step="any" value={embedLng} onChange={(e) => setEmbedLng(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="embedZoom">Zoom</Label>
                    <Input id="embedZoom" type="number" min="1" max="18" value={embedZoom} onChange={(e) => setEmbedZoom(e.target.value)} />
                  </div>
                </CardContent>
              </Card>

              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">HTML Snippet</CardTitle>
                    <CardDescription>Copy and paste this into any page.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-sm bg-muted rounded-md p-4 overflow-x-auto select-all">
                      {`<iframe src="${embedUrl}" width="100%" height="450" style="border:0;border-radius:6px;" allowfullscreen></iframe>`}
                    </pre>
                  </CardContent>
                </Card>

                <Card className="flex flex-col h-[420px]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Live Preview</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 p-4 pt-0">
                    <div className="w-full h-full rounded-md overflow-hidden border">
                      <iframe
                        key={embedUrl}
                        src={embedUrl}
                        className="w-full h-full border-0"
                        title="Embed preview"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

            </div>
          </TabsContent>

        </Tabs>
      </main>

      <footer className="border-t py-4">
        <p className="text-center text-sm text-muted-foreground">
          Leaflet Maps - FCC PED
        </p>
      </footer>
    </div>
  );
}
