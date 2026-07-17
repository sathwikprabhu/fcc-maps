import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useGlobal } from '../context/GlobalContext';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Plus,
  Link2,
  Pencil,
  Check,
  Code,
} from 'lucide-react';

// ── Per-row component to isolate copy state ──────────────────────────────────
function MapTableRow({ map }: { map: { id: string; name: string; createdAt: string } }) {
  const navigate = useNavigate();

  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const buildEmbedUrl = () => {
    return `${window.location.origin}/embed/?map=${map.id}`;
  };

  const handleCopyEmbed = async () => {
    const url = buildEmbedUrl();
    const iframeCode = `<iframe src="${url}" width="100%" height="500" frameborder="0" allowfullscreen></iframe>`;
    try {
      await navigator.clipboard.writeText(iframeCode);
      setCopiedEmbed(true);
      setTimeout(() => setCopiedEmbed(false), 2000);
      toast.success('Embed code copied!');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(buildEmbedUrl());
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
      toast.success('URL copied!');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <TableRow>
      {/* Name (Clickable link to edit page) */}
      <TableCell className="font-medium">
        <Link
          to={`/maps/${map.id}/edit`}
          className="hover:underline hover:text-primary transition-colors font-semibold"
        >
          {map.name}
        </Link>
      </TableCell>

      {/* Copy Embed Code */}
      <TableCell>
        <Button variant="outline" size="sm" onClick={handleCopyEmbed}>
          {copiedEmbed ? (
            <>
              <Check className="h-4 w-4 text-green-600" />
              Embed Code
            </>
          ) : (
            <>
              <Code className="h-4 w-4" />
              Copy Embed Code
            </>
          )}
        </Button>
      </TableCell>

      {/* Copy URL */}
      <TableCell>
        <Button variant="outline" size="sm" onClick={handleCopyUrl}>
          {copiedUrl ? (
            <>
              <Check className="h-4 w-4 text-green-600" />
              Copy URL
            </>
          ) : (
            <>
              <Link2 className="h-4 w-4" />
              Copy URL
            </>
          )}
        </Button>
      </TableCell>

      {/* Edit */}
      <TableCell className="text-right">
        <Button variant="link" size="sm" onClick={() => navigate(`/maps/${map.id}/edit`)}>
          <Pencil className="h-4 w-4" />
          Edit
        </Button>
      </TableCell>
    </TableRow>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function MapsList() {
  const { maps, fetchMaps } = useGlobal();
  const navigate = useNavigate();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mapName, setMapName] = useState('');
  const [mapId, setMapId] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Derive customized safe ID
  const sanitizedId = mapId.trim().toLowerCase().replace(/[^a-z0-9\-_]/g, '_');

  const handleOpenDialog = () => {
    setMapName('');
    setMapId('');
    setDialogOpen(true);
  };

  const handleCreateMap = async () => {
    if (!sanitizedId) {
      toast.error('Map ID is required');
      return;
    }
    
    setIsCreating(true);
    try {
      const res = await fetch('/api/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sanitizedId, name: mapName.trim() || sanitizedId }),
      });
      if (res.ok) {
        const data = await res.json();
        await fetchMaps();
        setDialogOpen(false);
        toast.success(`Map "${data.name}" created successfully`);
        navigate(`/maps/${data.id}/edit`);
      } else {
        const err = await res.json();
        toast.error(`Failed to create map: ${err.error || 'Unknown error'}`);
      }
    } catch {
      toast.error('Network error creating map');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold tracking-tight">Maps</h1>
        <Button onClick={handleOpenDialog}>
          <Plus className="h-4 w-4" />
          Add New Map
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Map</DialogTitle>
            <DialogDescription>
              Create a new map view. The Map ID is used in the embed URL and cannot be changed later.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="new-map-name">Display Name</Label>
              <Input
                id="new-map-name"
                placeholder="e.g. Europe Map"
                value={mapName}
                onChange={(e) => {
                  setMapName(e.target.value);
                  // Auto-fill mapId from name if mapId is empty or matches previous generation
                  const generatedId = e.target.value.toLowerCase().replace(/[^a-z0-9\-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
                  setMapId(generatedId);
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-map-id">Map ID</Label>
              <Input
                id="new-map-id"
                placeholder="e.g. europe-map"
                value={mapId}
                onChange={(e) => setMapId(e.target.value)}
              />
              {mapId && sanitizedId !== mapId && (
                <p className="text-xs text-muted-foreground">
                  Will be saved as: <span className="font-mono font-semibold">{sanitizedId}</span>
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button onClick={handleCreateMap} disabled={isCreating || !sanitizedId}>
              {isCreating ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Configured Maps</CardTitle>
        </CardHeader>
        <CardContent>
          {maps.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center border rounded-md border-dashed">
              <h3 className="text-lg font-semibold mb-2">No maps found</h3>
              <p className="text-muted-foreground mb-4">You haven't created any maps yet.</p>
              <Button onClick={handleOpenDialog}>
                Create your first map
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* Widen name column */}
                    <TableHead className="w-[50%]">Name</TableHead>
                    <TableHead>Embed Code</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {maps.map((map) => (
                    <MapTableRow key={map.id} map={map} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
