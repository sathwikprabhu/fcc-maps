import { useState, useEffect } from 'react';
import { useGlobal } from '../context/GlobalContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { UploadCloud, Image as ImageIcon, Trash2, Save } from 'lucide-react';
import type { Settings } from '../types';

export default function Branding() {
  const { settings, fetchData } = useGlobal();
  const [formSettings, setFormSettings] = useState<Settings>({ ...settings });
  const [isSaving, setIsSaving] = useState(false);
  const mapId = 'default';

  useEffect(() => {
    setFormSettings({ ...settings });
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Merge only branding fields on top of current saved settings to avoid
      // overwriting WordPress/sync settings this page doesn't manage.
      const currentRes = await fetch(`/api/maps/${mapId}/settings`);
      const currentSettings = currentRes.ok ? await currentRes.json() : {};

      const res = await fetch(`/api/maps/${mapId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...currentSettings,
          appTitle: formSettings.appTitle,
          logoUrl: formSettings.logoUrl,
          logoCollapsedUrl: formSettings.logoCollapsedUrl,
          faviconUrl: formSettings.faviconUrl,
        }),
      });
      if (res.ok) {
        toast.success('Branding settings saved successfully');
        fetchData(mapId); // Refresh global state to update sidebar/header
      } else {
        const err = await res.json();
        toast.error(`Failed to save: ${err.error || 'Unknown error'}`);
      }
    } catch (error) {
      toast.error('Network error saving branding');
    } finally {
      setIsSaving(false);
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
          toast.success('Logo uploaded successfully');
        } else {
          toast.error('Failed to upload logo image');
        }
      } catch (err) {
        toast.error('Error uploading logo');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLogoCollapsedUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
          setFormSettings(prev => ({ ...prev, logoCollapsedUrl: data.url }));
          toast.success('Collapsed logo uploaded successfully');
        } else {
          toast.error('Failed to upload collapsed logo image');
        }
      } catch (err) {
        toast.error('Error uploading collapsed logo');
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
          toast.success('Favicon uploaded successfully');
        } else {
          toast.error('Failed to upload favicon image');
        }
      } catch (err) {
        toast.error('Error uploading favicon');
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold tracking-tight">Branding</h1>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" /> Save Branding
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize how the mapping application looks to your users.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">

          <div className="space-y-3 max-w-md">
            <Label htmlFor="appTitle">Application Title</Label>
            <Input
              id="appTitle"
              type="text"
              placeholder="FCC Maps"
              value={formSettings.appTitle || ''}
              onChange={(e) => setFormSettings(prev => ({ ...prev, appTitle: e.target.value }))}
            />
            <p className="text-sm text-muted-foreground">This is displayed in the sidebar and browser tab.</p>
          </div>

          <Separator />

          <div className="space-y-4">
            <Label>Header Logo</Label>
            <div className="flex items-start gap-6">
              <div className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center w-48 h-32 bg-muted/30 relative overflow-hidden group">
                {formSettings.logoUrl ? (
                  <img src={formSettings.logoUrl} alt="Logo Preview" className="h-full w-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center text-muted-foreground">
                    <ImageIcon className="h-8 w-8 mb-2 opacity-50" />
                    <span className="text-xs font-medium">No logo set</span>
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-4 pt-2">
                <div className="flex items-center gap-2">
                  <Button variant="secondary" className="relative cursor-pointer overflow-hidden">
                    <UploadCloud className="mr-2 h-4 w-4" />
                    Upload Logo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </Button>
                  {formSettings.logoUrl && (
                    <Button variant="ghost" className="text-destructive" onClick={() => setFormSettings(prev => ({ ...prev, logoUrl: '' }))}>
                      <Trash2 className="mr-2 h-4 w-4" /> Remove
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Recommended size: 256x256px or wider. PNG or SVG with transparent background works best.
                </p>
            </div>
          </div>
        </div>

        <Separator />

          <div className="space-y-4">
            <Label>Header Logo (Collapsed)</Label>
            <div className="flex items-start gap-6">
              <div className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center w-24 h-24 bg-muted/30 relative overflow-hidden group">
                {formSettings.logoCollapsedUrl ? (
                  <img src={formSettings.logoCollapsedUrl} alt="Collapsed Logo Preview" className="h-full w-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center text-muted-foreground">
                    <ImageIcon className="h-6 w-6 mb-2 opacity-50" />
                    <span className="text-[10px] font-medium text-center">No logo set</span>
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-4 pt-1">
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" className="relative cursor-pointer overflow-hidden">
                    <UploadCloud className="mr-2 h-4 w-4" />
                    Upload Collapsed Logo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoCollapsedUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </Button>
                  {formSettings.logoCollapsedUrl && (
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setFormSettings(prev => ({ ...prev, logoCollapsedUrl: '' }))}>
                      <Trash2 className="mr-2 h-4 w-4" /> Remove
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Recommended size: 64x64px square. Displays when the sidebar is collapsed.
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <Label>Browser Favicon</Label>
            <div className="flex items-start gap-6">
              <div className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center w-24 h-24 bg-muted/30 relative overflow-hidden">
                {formSettings.faviconUrl ? (
                  <img src={formSettings.faviconUrl} alt="Favicon Preview" className="h-full w-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center text-muted-foreground">
                    <ImageIcon className="h-6 w-6 mb-2 opacity-50" />
                    <span className="text-[10px] font-medium text-center">No favicon</span>
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-4 pt-1">
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" className="relative cursor-pointer overflow-hidden">
                    <UploadCloud className="mr-2 h-4 w-4" />
                    Upload Favicon
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFaviconUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </Button>
                  {formSettings.faviconUrl && (
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setFormSettings(prev => ({ ...prev, faviconUrl: '' }))}>
                      <Trash2 className="mr-2 h-4 w-4" /> Remove
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Should be a square image (32x32px or 64x64px), ideally .ico or .png format.
                </p>
              </div>
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
