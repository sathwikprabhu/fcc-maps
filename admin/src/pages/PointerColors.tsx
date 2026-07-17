import { useState, useEffect } from 'react';
import { useGlobal } from '../context/GlobalContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ColorPicker } from '@/components/ui/color-picker';
import { toast } from 'sonner';

const MAP_ID = 'default';

export default function PointerColors() {
  const { colors, setColors } = useGlobal();
  const [isSaving, setIsSaving] = useState(false);

  // Fetch taxonomies + colors locally for the default map so this page
  // always has fresh data regardless of which map was visited last.
  const [taxonomies, setTaxonomies] = useState<{ categories: string[]; tags: string[] }>({
    categories: [],
    tags: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/maps/${MAP_ID}/taxonomy-list`).then(r => r.ok ? r.json() : { categories: [], tags: [] }),
      fetch(`/api/maps/${MAP_ID}/colors`).then(r => r.ok ? r.json() : { categories: {}, tags: {} }),
    ])
      .then(([tax, cols]) => {
        setTaxonomies(tax);
        setColors(cols);
      })
      .catch(() => {
        toast.error('Failed to load taxonomy data');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSaveColors = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/maps/${MAP_ID}/colors`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(colors),
      });
      if (res.ok) {
        toast.success('Colors saved successfully');
      } else {
        const err = await res.json();
        toast.error(`Failed to save: ${err.error || 'Unknown error'}`);
      }
    } catch {
      toast.error('Network error saving colors');
    } finally {
      setIsSaving(false);
    }
  };

  const noCategories = !loading && taxonomies.categories.length === 0;
  const noTags = !loading && taxonomies.tags.length === 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold tracking-tight">Pointer Colors</h1>
        <Button onClick={handleSaveColors} disabled={isSaving || loading}>
          {isSaving ? 'Saving…' : 'Save Colors'}
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-8 pt-6">

          {/* ── Categories ── */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary" /> Pointer Pin Colors (by Category)
            </h3>
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="w-48">Color</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : noCategories ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                        No categories found. Sync the Default Map first.
                      </TableCell>
                    </TableRow>
                  ) : (
                    taxonomies.categories.map(category => (
                      <TableRow key={category}>
                        <TableCell className="font-medium">{category}</TableCell>
                        <TableCell>
                          <ColorPicker
                            value={colors.categories[category] || '#ef4444'}
                            onChange={(color) => setColors(prev => ({
                              ...prev,
                              categories: { ...prev.categories, [category]: color },
                            }))}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* ── Tags ── */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-muted-foreground" /> Popup Badge Colors (by Tag)
            </h3>
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tag</TableHead>
                    <TableHead className="w-48">Color</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : noTags ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                        No tags found. Sync the Default Map first.
                      </TableCell>
                    </TableRow>
                  ) : (
                    taxonomies.tags.map(tag => (
                      <TableRow key={tag}>
                        <TableCell className="font-medium">{tag}</TableCell>
                        <TableCell>
                          <ColorPicker
                            value={colors.tags[tag] || '#71717a'}
                            onChange={(color) => setColors(prev => ({
                              ...prev,
                              tags: { ...prev.tags, [tag]: color },
                            }))}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
