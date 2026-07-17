import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGlobal } from '../context/GlobalContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MultiSelect } from '@/components/ui/multi-select';
import type { Option } from '@/components/ui/multi-select';
import { toast } from 'sonner';
import { ArrowLeft, Save, Trash2, Info, Link2, Code, Check } from 'lucide-react';
import type { Settings } from '../types';

export default function MapEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { settings, maps, fetchData, fetchMaps, handleDeleteMap } = useGlobal();

  // References to communicate with Leaflet iframe
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isMapMoveMessageRef = useRef(false);

  // Taxonomies fetched locally per-map (not from GlobalContext which is shared/stale)
  const [localTaxonomies, setLocalTaxonomies] = useState<{ tags: string[]; categories: string[] }>({ tags: [], categories: [] });
  const [taxLoading, setTaxLoading] = useState(false);

  const [mapName, setMapName] = useState('');
  const [formSettings, setFormSettings] = useState<Settings>({ ...settings });
  // Initialize filters from persisted settings
  const [selectedTags, setSelectedTags] = useState<string[]>(settings.filterTags ?? []);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(settings.filterCategories ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  // Static iframe URL to avoid complete reloads when panning/zooming
  const [iframeUrl, setIframeUrl] = useState('');

  // Sync map name from global maps list
  useEffect(() => {
    const found = maps.find(m => m.id === id);
    if (found) setMapName(found.name);
  }, [maps, id]);

  // Fetch settings + taxonomies when map id changes
  useEffect(() => {
    if (!id) return;
    fetchData(id);
    // Fetch taxonomies locally so they are always scoped to this specific map
    setTaxLoading(true);
    fetch(`/api/maps/${id}/taxonomy-list`)
      .then(r => r.ok ? r.json() : { tags: [], categories: [] })
      .then(data => setLocalTaxonomies(data))
      .catch(() => setLocalTaxonomies({ tags: [], categories: [] }))
      .finally(() => setTaxLoading(false));
  }, [id]);

  // Sync settings (including persisted filters) when they load from server
  useEffect(() => {
    setFormSettings({ ...settings });
    setSelectedTags(settings.filterTags ?? []);
    setSelectedCategories(settings.filterCategories ?? []);

    // Set initial iframe URL with the loaded configurations
    const params = new URLSearchParams();
    params.set('map', id || 'default');
    params.set('lat', settings.defaultLat.toString());
    params.set('lng', settings.defaultLng.toString());
    params.set('zoom', settings.defaultZoom.toString());
    if (settings.filterTags?.length) params.set('tags', settings.filterTags.join(','));
    if (settings.filterCategories?.length) params.set('categories', settings.filterCategories.join(','));

    setIframeUrl(`${window.location.origin}/embed/?${params.toString()}`);
  }, [settings]);

  // Listen to message events from Leaflet embed iframe to update Lat, Lng, Zoom
  useEffect(() => {
    const handleMapMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (data && data.type === 'map_move') {
        isMapMoveMessageRef.current = true;
        setFormSettings(prev => ({
          ...prev,
          defaultLat: data.lat,
          defaultLng: data.lng,
          defaultZoom: data.zoom
        }));
      }
    };
    window.addEventListener('message', handleMapMessage);
    return () => window.removeEventListener('message', handleMapMessage);
  }, []);

  // Update programmatic Leaflet view when coordinates or zoom are changed via sliders
  useEffect(() => {
    if (isMapMoveMessageRef.current) {
      isMapMoveMessageRef.current = false;
      return; // Skip sending message if the change was initiated by the map dragging itself
    }
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'set_map_view',
        lat: formSettings.defaultLat,
        lng: formSettings.defaultLng,
        zoom: formSettings.defaultZoom
      }, '*');
    }
  }, [formSettings.defaultLat, formSettings.defaultLng, formSettings.defaultZoom]);

  // Reload/update the iframe preview ONLY when filters, clustering, or map view changes
  useEffect(() => {
    if (!iframeUrl) return; // Wait until initial settings load
    const params = new URLSearchParams();
    params.set('map', id || 'default');
    params.set('lat', formSettings.defaultLat.toString());
    params.set('lng', formSettings.defaultLng.toString());
    params.set('zoom', formSettings.defaultZoom.toString());
    params.set('clustering', formSettings.enableClustering ? '1' : '0');
    if (selectedTags.length > 0) params.set('tags', selectedTags.join(','));
    if (selectedCategories.length > 0) params.set('categories', selectedCategories.join(','));

    setIframeUrl(`${window.location.origin}/embed/?${params.toString()}`);
  }, [selectedTags, selectedCategories, formSettings.enableClustering, id]);

  const handleSave = async () => {
    if (!id) return;
    setIsSaving(true);
    try {
      // Save display name if changed
      const currentName = maps.find(m => m.id === id)?.name;
      if (mapName.trim() && mapName.trim() !== currentName) {
        const nameRes = await fetch(`/api/maps/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: mapName.trim() }),
        });
        if (nameRes.ok) await fetchMaps();
      }

      // Save settings (includes filterTags + filterCategories)
      const res = await fetch(`/api/maps/${id}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formSettings,
          filterTags: selectedTags,
          filterCategories: selectedCategories,
        }),
      });
      if (res.ok) {
        toast.success('Map saved successfully');
      } else {
        const err = await res.json();
        toast.error(`Failed to save: ${err.error || 'Unknown error'}`);
      }
    } catch {
      toast.error('Network error saving settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setIsDeleting(true);
    const success = await handleDeleteMap(id);
    setIsDeleting(false);
    setDeleteOpen(false);
    if (success) navigate('/');
  };

  const mapUrlParams = new URLSearchParams();
  mapUrlParams.set('map', id || 'default');
  mapUrlParams.set('lat', formSettings.defaultLat.toString());
  mapUrlParams.set('lng', formSettings.defaultLng.toString());
  mapUrlParams.set('zoom', formSettings.defaultZoom.toString());
  if (selectedTags.length > 0) mapUrlParams.set('tags', selectedTags.join(','));
  if (selectedCategories.length > 0) mapUrlParams.set('categories', selectedCategories.join(','));

  const embedUrl = `${window.location.origin}/embed/?${mapUrlParams.toString()}`;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(embedUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
      toast.success('URL copied!');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleCopyEmbed = async () => {
    const iframeCode = `<iframe src="${embedUrl}" width="100%" height="500" frameborder="0" allowfullscreen></iframe>`;
    try {
      await navigator.clipboard.writeText(iframeCode);
      setCopiedEmbed(true);
      setTimeout(() => setCopiedEmbed(false), 2000);
      toast.success('Embed code copied!');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const tagOptions: Option[] = localTaxonomies.tags.map(tag => ({ label: tag, value: tag }));
  const catOptions: Option[] = localTaxonomies.categories.map(cat => ({ label: cat, value: cat }));
  const hasTaxonomies = localTaxonomies.tags.length > 0 || localTaxonomies.categories.length > 0;

  const isDefault = id === 'default';

  return (
    <div className="space-y-6 h-full flex flex-col max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Edit Map</h1>
            <p className="text-sm text-muted-foreground font-mono mt-0.5">ID: {id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="link"
            onClick={() => setDeleteOpen(true)}
            className="text-destructive hover:text-destructive/90 hover:no-underline disabled:text-muted-foreground disabled:opacity-50"
            disabled={isDefault}
          >
            <Trash2 className="h-4 w-4" />
            Delete Map
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving…' : 'Save Settings'}
          </Button>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,30rem)_1fr] gap-6 flex-1 min-h-0">
        <Card className="flex flex-col h-full overflow-hidden">
          <CardContent className="space-y-6 overflow-y-auto flex-1 pt-6">

            <div className="space-y-3">
              <Label htmlFor="map-name">Display Name</Label>
              <Input
                id="map-name"
                value={mapName}
                onChange={(e) => setMapName(e.target.value)}
                placeholder="e.g. Europe Campus Map"
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="map-description">Description</Label>
              <Textarea
                id="map-description"
                value={formSettings.description || ''}
                onChange={(e) => setFormSettings({ ...formSettings, description: e.target.value })}
                placeholder="Add a short description that appears in the embed header"
                className="min-h-[96px] resize-none"
              />
            </div>

            <div className="space-y-4 border-t pt-4">
              {/* Zoom */}
              <div className="space-y-3">
                <Label>Default Zoom ({formSettings.defaultZoom})</Label>
                <Slider
                  min={1} max={18} step={1}
                  value={[formSettings.defaultZoom]}
                  onValueChange={(vals) => setFormSettings({ ...formSettings, defaultZoom: vals[0] })}
                />
              </div>

              {/* Latitude */}
              <div className="space-y-3">
                <Label>Latitude ({formSettings.defaultLat.toFixed(0)})</Label>
                <Slider
                  min={-90} max={90} step={1}
                  value={[formSettings.defaultLat]}
                  onValueChange={(vals) => setFormSettings({ ...formSettings, defaultLat: vals[0] })}
                />
              </div>

              {/* Longitude */}
              <div className="space-y-3">
                <Label>Longitude ({formSettings.defaultLng.toFixed(0)})</Label>
                <Slider
                  min={-180} max={180} step={1}
                  value={[formSettings.defaultLng]}
                  onValueChange={(vals) => setFormSettings({ ...formSettings, defaultLng: vals[0] })}
                />
              </div>

              {/* Clustering */}
              <div className="flex items-center justify-between border rounded-md p-4 mt-2">
                <div className="space-y-0.5">
                  <Label className="text-base">Enable Clustering</Label>
                  <p className="text-sm text-muted-foreground">
                    Group nearby markers into clusters when zoomed out.
                  </p>
                </div>
                <Switch
                  checked={formSettings.enableClustering}
                  onCheckedChange={(checked) => setFormSettings({ ...formSettings, enableClustering: checked })}
                />
              </div>
            </div>

            {/* ── Preview Filters (Hidden for Default Map) ── */}
            {!isDefault && (
              <div className="pt-4 border-t space-y-4">

                {taxLoading ? (
                  <p className="text-sm text-muted-foreground">Loading taxonomies…</p>
                ) : !hasTaxonomies ? (
                  <div className="flex items-start gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    <Info className="h-4 w-4 shrink-0" />
                    <span>
                      No tags or categories found for this map. Configure the WordPress API URL in{' '}
                      <strong>Settings</strong> and run a sync to populate filters.
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      <Label>Tags</Label>
                      <MultiSelect
                        options={tagOptions}
                        selected={selectedTags}
                        onChange={setSelectedTags}
                        placeholder="Select tags…"
                      />
                    </div>

                    <div className="space-y-3">
                      <Label>Categories</Label>
                      <MultiSelect
                        options={catOptions}
                        selected={selectedCategories}
                        onChange={setSelectedCategories}
                        placeholder="Select categories…"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Copy URLs ── */}
            <div className="pt-4 border-t space-y-4">
              <div className="space-y-3">
                <Label>Embed URL</Label>
                <div className="flex gap-2">
                  <Input value={embedUrl} readOnly className="font-mono text-xs bg-muted" />
                  <Button variant="outline" size="sm" onClick={handleCopyUrl} className="shrink-0">
                    {copiedUrl ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                    Copy URL
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Copy Embed Code (iframe)</Label>
                <div className="flex gap-2">
                  <Input
                    value={`<iframe src="${embedUrl}" width="100%" height="500" frameborder="0" allowfullscreen></iframe>`}
                    readOnly
                    className="font-mono text-xs bg-muted"
                  />
                  <Button variant="outline" size="sm" onClick={handleCopyEmbed} className="shrink-0">
                    {copiedEmbed ? <Check className="h-4 w-4" /> : <Code className="h-4 w-4" />}
                    Copy Embed Code
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Preview */}
        <Card className="flex flex-col h-[600px] lg:h-auto overflow-hidden">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Live Preview</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            <iframe
              ref={iframeRef}
              src={iframeUrl}
              className="w-full h-full border-0"
              title="Map Preview"
              key={`${id}-${selectedTags.join(',')}-${selectedCategories.join(',')}-${formSettings.enableClustering}`}
            />
          </CardContent>
        </Card>
      </div>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{mapName || id}"?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 pt-1">
                <p>
                  This action <strong>cannot be undone</strong>. All settings, sync data, and
                  marker data for this map will be <strong>lost permanently</strong>.
                </p>
                <p className="text-muted-foreground text-xs">
                  The <code className="font-mono">{id}</code> embed URL will stop working immediately.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting} className="text-white">
              <Trash2 className="h-4 w-4 text-white" />
              {isDeleting ? 'Deleting…' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
