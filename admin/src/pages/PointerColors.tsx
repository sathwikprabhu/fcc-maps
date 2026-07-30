import { useState, useEffect } from 'react';
import { useGlobal } from '../context/GlobalContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ColorPicker } from '@/components/ui/color-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { RotateCcw, Save, Trash2 } from 'lucide-react';

const MAP_ID = 'default';

export default function PointerColors() {
  const { colors, setColors } = useGlobal();
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: 'all' | 'categories' | 'tags';
    title: string;
    description: string;
  }>({
    open: false,
    type: 'all',
    title: '',
    description: '',
  });

  // Fetch taxonomies + colors locally for default map
  const [taxonomies, setTaxonomies] = useState<{ categories: string[]; tags: string[] }>({
    categories: [],
    tags: [],
  });
  const [loading, setLoading] = useState(true);

  const loadData = () => {
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
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveColors = async (newColorsToSave = colors) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/maps/${MAP_ID}/colors`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newColorsToSave),
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

  const handleExecuteReset = async () => {
    setIsResetting(true);
    try {
      let updatedColors = { ...colors };
      if (confirmDialog.type === 'all') {
        updatedColors = { categories: {}, tags: {} };
      } else if (confirmDialog.type === 'categories') {
        updatedColors = { ...updatedColors, categories: {} };
      } else if (confirmDialog.type === 'tags') {
        updatedColors = { ...updatedColors, tags: {} };
      }

      setColors(updatedColors);
      const res = await fetch(`/api/maps/${MAP_ID}/colors`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedColors),
      });

      if (res.ok) {
        toast.success(
          confirmDialog.type === 'all'
            ? 'All colors reset to default map pointer'
            : confirmDialog.type === 'categories'
            ? 'Category pin colors reset to default'
            : 'Tag badge colors reset to default'
        );
      } else {
        toast.error('Failed to reset colors on server');
      }
    } catch {
      toast.error('Network error resetting colors');
    } finally {
      setIsResetting(false);
      setConfirmDialog({ open: false, type: 'all', title: '', description: '' });
    }
  };

  const handleClearSingleCategory = (category: string) => {
    const nextCategories = { ...colors.categories };
    delete nextCategories[category];
    setColors(prev => ({ ...prev, categories: nextCategories }));
  };

  const handleClearSingleTag = (tag: string) => {
    const nextTags = { ...colors.tags };
    delete nextTags[tag];
    setColors(prev => ({ ...prev, tags: nextTags }));
  };

  const noCategories = !loading && taxonomies.categories.length === 0;
  const noTags = !loading && taxonomies.tags.length === 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pointer Colors</h1>
          <p className="text-sm text-muted-foreground">
            Customise marker pin colors and popup badge colors for categories and tags.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() =>
              setConfirmDialog({
                open: true,
                type: 'all',
                title: 'Reset All Colors?',
                description:
                  'Are you sure you want to reset all pointer pin colors and popup badge colors? Markers will revert to the default blue map pointer.',
              })
            }
            disabled={loading || isSaving || isResetting}
          >
            <RotateCcw data-icon="inline-start" className="size-4" />
            Reset All Colors
          </Button>

          <Button onClick={() => handleSaveColors()} disabled={isSaving || loading}>
            <Save data-icon="inline-start" className="size-4" />
            {isSaving ? 'Saving…' : 'Save Colors'}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-8 pt-6">
          {/* ── Categories ── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary" /> Pointer Pin Colors (by Category)
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setConfirmDialog({
                    open: true,
                    type: 'categories',
                    title: 'Reset Category Pin Colors?',
                    description:
                      'Are you sure you want to reset all category colors? Pins will show the default map pointer.',
                  })
                }
                disabled={loading || isSaving || isResetting}
              >
                <RotateCcw data-icon="inline-start" className="size-3.5" />
                Reset Category Colors
              </Button>
            </div>

            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="w-64">Color</TableHead>
                    <TableHead className="w-24 text-right">Reset</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : noCategories ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        No categories found. Sync the Default Map first.
                      </TableCell>
                    </TableRow>
                  ) : (
                    taxonomies.categories.map((category) => {
                      const customColor = colors.categories?.[category];
                      return (
                        <TableRow key={category}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <span>{category}</span>
                              {!customColor && (
                                <span className="text-[10px] font-mono uppercase bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                                  Default (#2563eb)
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <ColorPicker
                              value={customColor || '#2563eb'}
                              onChange={(color) =>
                                setColors((prev) => ({
                                  ...prev,
                                  categories: { ...prev.categories, [category]: color },
                                }))
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            {customColor ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleClearSingleCategory(category)}
                                title="Reset to default blue pointer"
                              >
                                Reset
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground select-none">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* ── Tags ── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-muted-foreground" /> Popup Badge Colors (by Tag)
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setConfirmDialog({
                    open: true,
                    type: 'tags',
                    title: 'Reset Tag Badge Colors?',
                    description:
                      'Are you sure you want to reset all tag badge colors? Badges will show the default badge styling.',
                  })
                }
                disabled={loading || isSaving || isResetting}
              >
                <RotateCcw data-icon="inline-start" className="size-3.5" />
                Reset Tag Colors
              </Button>
            </div>

            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tag</TableHead>
                    <TableHead className="w-64">Color</TableHead>
                    <TableHead className="w-24 text-right">Reset</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : noTags ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        No tags found. Sync the Default Map first.
                      </TableCell>
                    </TableRow>
                  ) : (
                    taxonomies.tags.map((tag) => {
                      const customColor = colors.tags?.[tag];
                      return (
                        <TableRow key={tag}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <span>{tag}</span>
                              {!customColor && (
                                <span className="text-[10px] font-mono uppercase bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                                  Default Badge
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <ColorPicker
                              value={customColor || '#71717a'}
                              onChange={(color) =>
                                setColors((prev) => ({
                                  ...prev,
                                  tags: { ...prev.tags, [tag]: color },
                                }))
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            {customColor ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleClearSingleTag(tag)}
                                title="Reset to default badge style"
                              >
                                Reset
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground select-none">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          setConfirmDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
            <DialogDescription>{confirmDialog.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() =>
                setConfirmDialog((prev) => ({ ...prev, open: false }))
              }
              disabled={isResetting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleExecuteReset}
              disabled={isResetting}
            >
              <Trash2 data-icon="inline-start" className="size-4" />
              {isResetting ? 'Resetting…' : 'Reset Colors'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
