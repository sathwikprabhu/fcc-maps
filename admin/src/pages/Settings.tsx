import { useState, useEffect } from 'react';
import { useGlobal } from '../context/GlobalContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Copy, Loader2, Key } from 'lucide-react';
import type { Settings } from '../types';

const PRESETS = [
  { name: 'CartoDB Voyager (Default)', url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png' },
  { name: 'CartoDB Positron (Light Minimal)', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' },
  { name: 'CartoDB Dark Matter (Dark Mode)', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' },
  { name: 'OpenStreetMap Standard (Detailed)', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' },
  { name: 'Esri World Imagery (Satellite)', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
  { name: 'Esri World Street Map (Detailed Roads)', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}' },
  { name: 'OpenTopoMap (Topographical)', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png' },
  { name: 'MapTiler Landscape (Requires API Key)', url: 'https://api.maptiler.com/maps/landscape/{z}/{x}/{y}.png?key={apiKey}' },
];

export default function SettingsPage() {
  const { settings, fetchData } = useGlobal();
  const [formSettings, setFormSettings] = useState<Settings>({ ...settings });
  const [isSaving, setIsSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [showCredentialFields, setShowCredentialFields] = useState(false);
  const [selectedPresetName, setSelectedPresetName] = useState<string>('CartoDB Voyager (Default)');

  const mapId = 'default';

  useEffect(() => {
    setFormSettings({ ...settings });
    
    // Sync dropdown selection with loaded baseMapUrl
    const match = PRESETS.find(p => p.url === settings.baseMapUrl);
    if (match) {
      setSelectedPresetName(match.name);
    } else if (settings.baseMapUrl) {
      setSelectedPresetName('custom');
    } else {
      setSelectedPresetName('CartoDB Voyager (Default)');
    }
  }, [settings]);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/maps/${mapId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formSettings),
      });
      if (res.ok) {
        toast.success('Settings saved successfully');
        setShowCredentialFields(false); // Hide credentials after saving
        fetchData(mapId);
      } else {
        const err = await res.json();
        toast.error(`Failed to save: ${err.error || 'Unknown error'}`);
      }
    } catch (error) {
      toast.error('Network error saving settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const res = await fetch(`/api/maps/${mapId}/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formSettings),
      });
      if (res.ok) {
        toast.success('Connection successful! Posts found.');
      } else {
        const err = await res.json();
        toast.error(`Connection failed: ${err.error}`);
      }
    } catch (err) {
      toast.error('Network error testing connection');
    } finally {
      setTestingConnection(false);
    }
  };

  const cronUrl = `${window.location.origin}/api/maps/default/sync`;

  const getPreviewUrl = () => {
    let url = formSettings.baseMapUrl || 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    url = url.replace('{apiKey}', formSettings.mapTilerApiKey || '');
    return `${window.location.origin}/embed/?map=default&preview=1&baseMapUrl=${encodeURIComponent(url)}`;
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>WordPress REST API</CardTitle>
            <CardDescription>Connect to your WordPress site to pull marker data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label htmlFor="wpApiUrl">WordPress REST API Base URL</Label>
              <Input
                id="wpApiUrl"
                type="url"
                placeholder="https://example.com/wp-json/wp/v2"
                value={formSettings.wpApiUrl}
                onChange={(e) => setFormSettings(prev => ({ ...prev, wpApiUrl: e.target.value }))}
              />
              <p className="text-sm text-muted-foreground">
                Usually ends with <code>/wp-json/wp/v2</code>
              </p>
            </div>

            <div className="flex items-center justify-between border rounded-md p-4 mt-4">
              <div className="space-y-0.5">
                <Label>Require Authentication</Label>
                <p className="text-sm text-muted-foreground">
                  Enable if your WordPress REST API requires Basic Authentication.
                </p>
              </div>
              <Switch
                checked={formSettings.authEnabled}
                onCheckedChange={(checked) => setFormSettings(prev => ({ ...prev, authEnabled: checked }))}
              />
            </div>

            {formSettings.authEnabled && (
              <div className="space-y-4 pt-4">
                {!showCredentialFields && settings.hasCredentials ? (
                  <div className="bg-muted p-4 rounded-md border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Credentials configured</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setShowCredentialFields(true)}>
                      Configure
                    </Button>
                  </div>
                ) : (
                  <div className="border p-4 rounded-md bg-muted/30 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <Label htmlFor="username">Username / App ID</Label>
                        <Input
                          id="username"
                          type="text"
                          value={formSettings.username || ''}
                          onChange={(e) => setFormSettings(prev => ({ ...prev, username: e.target.value }))}
                          placeholder="Application Username"
                        />
                      </div>
                      <div className="space-y-3">
                        <Label htmlFor="password">Password / App Password</Label>
                        <Input
                          id="password"
                          type="password"
                          value={formSettings.password || ''}
                          onChange={(e) => setFormSettings(prev => ({ ...prev, password: e.target.value }))}
                          placeholder="Application Password"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleTestConnection}
                        disabled={testingConnection || !formSettings.wpApiUrl}
                      >
                        {testingConnection && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Test Connection
                      </Button>
                      <Button
                        type="button"
                        onClick={handleSaveSettings}
                        disabled={isSaving}
                      >
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!formSettings.authEnabled && (
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleTestConnection}
                  disabled={testingConnection || !formSettings.wpApiUrl}
                >
                  {testingConnection && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Test Connection
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={isSaving}
                >
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Settings
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Synchronization</CardTitle>
            <CardDescription>Manage automated data syncing from WordPress.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="syncIntervalHours">Background Sync Interval (Hours)</Label>
              <Input
                id="syncIntervalHours"
                type="number"
                min="1"
                max="168"
                value={formSettings.syncIntervalHours}
                onChange={(e) => setFormSettings(prev => ({ ...prev, syncIntervalHours: parseInt(e.target.value) || 12 }))}
                className="w-32"
              />
              <p className="text-sm text-muted-foreground">
                How frequently the backend automatically syncs data (default: 12 hours).
              </p>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label>External Trigger (Cron) URL</Label>
              <div className="flex gap-2 items-center mt-1">
                <Input value={cronUrl} readOnly className="bg-muted font-mono text-sm" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(cronUrl);
                    toast.success('Cron URL copied to clipboard');
                  }}
                  title="Copy URL"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Trigger a sync externally via a POST request to this endpoint.
              </p>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button type="button" onClick={handleSaveSettings} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Sync Settings
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Base Map Style</CardTitle>
            <CardDescription>Configure the background map style and layer provider details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="baseMapPreset">Base Map Style Preset</Label>
              <select
                id="baseMapPreset"
                value={selectedPresetName}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedPresetName(val);
                  if (val !== 'custom') {
                    const preset = PRESETS.find(p => p.name === val);
                    if (preset) {
                      setFormSettings(prev => ({ ...prev, baseMapUrl: preset.url }));
                    }
                  }
                }}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {PRESETS.map(preset => (
                  <option key={preset.name} value={preset.name}>{preset.name}</option>
                ))}
                <option value="custom">Custom Tile URL</option>
              </select>
            </div>

            {selectedPresetName === 'custom' && (
              <div className="space-y-3">
                <Label htmlFor="baseMapUrl">Custom Tile URL</Label>
                <Input
                  id="baseMapUrl"
                  type="url"
                  placeholder="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  value={formSettings.baseMapUrl || ''}
                  onChange={(e) => setFormSettings(prev => ({ ...prev, baseMapUrl: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Enter a standard Leaflet tile template URL containing <code>{`{s}`}</code>, <code>{`{z}`}</code>, <code>{`{x}`}</code>, and <code>{`{y}`}</code>. Use <code>{`{apiKey}`}</code> for the key placeholder.
                </p>
              </div>
            )}

            {(selectedPresetName === 'MapTiler Landscape (Requires API Key)' || selectedPresetName === 'custom') && (
              <div className="space-y-3">
                <Label htmlFor="mapTilerApiKey">API Key</Label>
                <Input
                  id="mapTilerApiKey"
                  type="text"
                  placeholder="Enter your API key"
                  value={formSettings.mapTilerApiKey || ''}
                  onChange={(e) => setFormSettings(prev => ({ ...prev, mapTilerApiKey: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Key used to authenticate requests for base map providers.
                </p>
              </div>
            )}

            {/* Live Preview of selected base map style */}
            <div className="pt-4 border-t space-y-3">
              <Label className="block text-sm font-medium">Base Map Style Preview</Label>
              <div className="h-60 rounded-md border overflow-hidden bg-muted">
                <iframe
                  src={getPreviewUrl()}
                  className="w-full h-full border-0 animate-in fade-in-0 duration-200"
                  title="Base Map Preview"
                  key={`${formSettings.baseMapUrl}-${formSettings.mapTilerApiKey}`}
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button type="button" onClick={handleSaveSettings} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Map Style
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
