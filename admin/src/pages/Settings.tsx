import { useState, useEffect } from 'react';
import { useGlobal } from '../context/GlobalContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Copy, Loader2, Key } from 'lucide-react';
import type { Settings } from '../types';

const MAP_STYLES = [
  { name: 'Liberty', value: 'liberty' },
  { name: 'Bright', value: 'bright' },
  { name: 'Positron', value: 'positron' },
  { name: 'Dark', value: 'dark' },
];

export default function SettingsPage() {
  const { settings, fetchData } = useGlobal();
  const [formSettings, setFormSettings] = useState<Settings>({ ...settings });
  const [isSaving, setIsSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [showCredentialFields, setShowCredentialFields] = useState(false);

  const mapId = 'default';

  useEffect(() => {
    fetchData(mapId);
  }, [mapId]);

  useEffect(() => {
    setFormSettings({ ...settings });
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
    const style = formSettings.baseMapStyle || 'liberty';
    const borders = formSettings.enableBorders !== false ? '1' : '0';
    return `${window.location.origin}/embed/?map=default&preview=1&baseMapStyle=${encodeURIComponent(style)}&enableBorders=${borders}`;
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
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label htmlFor="wpApiUrl">WordPress REST API Base URL</Label>
              <Input
                id="wpApiUrl"
                type="url"
                placeholder="https://yourdomain/wp-json/wp/v2/posts"
                value={formSettings.wpApiUrl}
                onChange={(e) => setFormSettings(prev => ({ ...prev, wpApiUrl: e.target.value }))}
              />
              <p className="text-sm text-muted-foreground">
                <code>https://yourdomain/wp-json/wp/v2/posts</code>
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
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="syncIntervalMinutes">Background Sync Interval (Minutes)</Label>
              <Input
                id="syncIntervalMinutes"
                type="number"
                min="1"
                max="525600"
                value={formSettings.syncIntervalMinutes}
                onChange={(e) => setFormSettings(prev => ({ ...prev, syncIntervalMinutes: parseInt(e.target.value) || 60 }))}
                className="w-32"
              />
              <p className="text-sm text-muted-foreground">
                How frequently the backend automatically syncs data (default: 60 minutes).
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
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="baseMapStyle">Map Style</Label>
              <select
                id="baseMapStyle"
                value={formSettings.baseMapStyle || 'liberty'}
                onChange={(e) => {
                  setFormSettings(prev => ({ ...prev, baseMapStyle: e.target.value }));
                }}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {MAP_STYLES.map(style => (
                  <option key={style.value} value={style.value}>{style.name}</option>
                ))}
              </select>
              <p className="text-sm text-muted-foreground">
                Choose the visual style for the map background. Tiles are served from OpenFreeMap.
              </p>
            </div>

            <div className="flex items-center justify-between border rounded-md p-4">
              <div className="space-y-0.5">
                <Label className="text-base">Show Country Borders</Label>
                <p className="text-sm text-muted-foreground">
                  Display country and administrative boundary lines on the map.
                </p>
              </div>
              <Switch
                checked={formSettings.enableBorders !== false}
                onCheckedChange={(checked) => setFormSettings(prev => ({ ...prev, enableBorders: checked }))}
              />
            </div>

            {/* Live Preview of selected base map style */}
            <div className="pt-4 border-t space-y-3">
              <Label className="block text-sm font-medium">Base Map Style Preview</Label>
              <div className="h-[420px] rounded-md border overflow-hidden bg-muted">
                <iframe
                  src={getPreviewUrl()}
                  className="w-full h-full border-0 animate-in fade-in-0 duration-200"
                  title="Base Map Preview"
                  key={`${formSettings.baseMapStyle}-${formSettings.enableBorders}`}
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

