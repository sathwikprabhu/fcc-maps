import express, { Router, Request, Response } from 'express';
import { storage } from '../services/storage';
import { scheduler } from '../scheduler/scheduler';
import { Settings } from '../types';

import { strictLimiter, standardLimiter, looseLimiter } from '../middleware/rateLimiter';
import fs from 'fs';
import path from 'path';

const router = Router();

// ---------------------------------------------------------------------------
// Private IP / loopback SSRF block list
// Rejects user-supplied URLs that point at internal/cloud-metadata addresses.
// ---------------------------------------------------------------------------
const PRIVATE_IP_RE = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.|localhost|::1|fc00:|fd|169\.254\.)/i;
const CLOUD_METADATA_RE = /169\.254\.169\.254/;

function isSsrfUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    const hostname = parsed.hostname.toLowerCase();
    return (
      PRIVATE_IP_RE.test(hostname) ||
      CLOUD_METADATA_RE.test(hostname) ||
      hostname === 'metadata.google.internal'
    );
  } catch {
    return true; // unparseable → reject
  }
}

// ---------------------------------------------------------------------------
// GET /api/settings — open read; credentials are NEVER sent to browser
// ---------------------------------------------------------------------------
router.get('/settings', looseLimiter, (req: Request, res: Response) => {
  try {
    const settings = storage.getSettings();
    const { password: _pw, username: _un, ...safeSettings } = settings as any;
    res.json({
      ...safeSettings,
      hasCredentials: !!(settings.username && settings.password),
    });
  } catch {
    res.status(500).json({ error: 'Failed to retrieve settings' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/settings — protected write
// ---------------------------------------------------------------------------
router.put('/settings', standardLimiter, (req: Request, res: Response) => {
  try {
    // Allowlist: only accept known Settings fields — no mass assignment
    const body = req.body ?? {};
    const newSettings: Settings = {
      wpApiUrl:           typeof body.wpApiUrl === 'string'           ? body.wpApiUrl.trim()          : '',
      authEnabled:        typeof body.authEnabled === 'boolean'       ? body.authEnabled              : false,
      username:           typeof body.username === 'string'           ? body.username                 : '',
      password:           typeof body.password === 'string'           ? body.password                 : '',
      syncIntervalHours:  typeof body.syncIntervalHours === 'number'  ? body.syncIntervalHours        : 12,
      defaultLat:         typeof body.defaultLat === 'number'         ? body.defaultLat               : 46.23307,
      defaultLng:         typeof body.defaultLng === 'number'         ? body.defaultLng               : 6.05551,
      defaultZoom:        typeof body.defaultZoom === 'number'        ? body.defaultZoom              : 8,
      enableClustering:   typeof body.enableClustering === 'boolean'  ? body.enableClustering         : true,
      logoUrl:            typeof body.logoUrl === 'string'            ? body.logoUrl.trim()           : '',
      appTitle:           typeof body.appTitle === 'string'           ? body.appTitle.trim()          : 'FCC Maps',
      faviconUrl:         typeof body.faviconUrl === 'string'         ? body.faviconUrl.trim()        : '',
      baseMapUrl:         typeof body.baseMapUrl === 'string'         ? body.baseMapUrl.trim()        : '',
    };

    if (!newSettings.wpApiUrl) {
      return res.status(400).json({ error: 'WordPress API URL is required' });
    }

    // URL format validation
    try {
      new URL(newSettings.wpApiUrl);
    } catch {
      return res.status(400).json({ error: 'Invalid WordPress API URL format' });
    }

    // SSRF protection — block private/loopback targets
    if (isSsrfUrl(newSettings.wpApiUrl)) {
      return res.status(400).json({ error: 'WordPress API URL must not point to a private or internal address.' });
    }

    if (typeof newSettings.syncIntervalHours !== 'number' || newSettings.syncIntervalHours < 1) {
      return res.status(400).json({ error: 'Sync interval must be at least 1 hour' });
    }
    if (newSettings.syncIntervalHours > 8760) {
      return res.status(400).json({ error: 'Sync interval cannot exceed 8760 hours (1 year)' });
    }

    // Validate coordinate bounds
    if (newSettings.defaultLat < -90 || newSettings.defaultLat > 90) {
      return res.status(400).json({ error: 'Default latitude must be between -90 and 90' });
    }
    if (newSettings.defaultLng < -180 || newSettings.defaultLng > 180) {
      return res.status(400).json({ error: 'Default longitude must be between -180 and 180' });
    }
    if (newSettings.defaultZoom < 1 || newSettings.defaultZoom > 20) {
      return res.status(400).json({ error: 'Default zoom must be between 1 and 20' });
    }

    // Preserve existing credentials if the client did not send new ones
    if (!newSettings.username || !newSettings.password) {
      const existing = storage.getSettings();
      if (!newSettings.username) newSettings.username = existing.username;
      if (!newSettings.password) newSettings.password = existing.password;
    }

    storage.saveSettings(newSettings);
    scheduler.reschedule();

    const { password: _pw, username: _un, ...safeSettings } = newSettings as any;
    res.json({
      message: 'Settings saved successfully',
      settings: { ...safeSettings, hasCredentials: !!(_un && _pw) },
    });
  } catch {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/upload-logo — protected write
// ---------------------------------------------------------------------------
router.post('/upload-logo', strictLimiter, express.json({ limit: '5mb' }), (req: Request, res: Response) => {
  try {
    const { filename, base64 } = req.body;
    if (typeof filename !== 'string' || typeof base64 !== 'string') {
      return res.status(400).json({ error: 'Filename and base64 data are required' });
    }
    if (!filename || !base64) {
      return res.status(400).json({ error: 'Filename and base64 data are required' });
    }

    // Validate MIME type — only allow safe image formats
    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];
    const mimeMatch = base64.match(/^data:([a-zA-Z0-9+/]+\/[a-zA-Z0-9+/\-]+);base64,/);
    if (!mimeMatch || !allowedMimeTypes.includes(mimeMatch[1])) {
      return res.status(400).json({ error: 'Invalid file type. Only PNG, JPEG, GIF, WebP, and SVG are allowed.' });
    }

    // Enforce extension matching MIME (no double-extension bypass)
    const mimeToExt: Record<string, string[]> = {
      'image/png':     ['.png'],
      'image/jpeg':    ['.jpg', '.jpeg'],
      'image/gif':     ['.gif'],
      'image/webp':    ['.webp'],
      'image/svg+xml': ['.svg'],
    };
    const ext = path.extname(filename).toLowerCase();
    const allowedExts = mimeToExt[mimeMatch[1]] || [];
    if (!allowedExts.includes(ext)) {
      return res.status(400).json({ error: `File extension '${ext}' does not match content type '${mimeMatch[1]}'.` });
    }

    // Strip data URI prefix before decoding
    const base64Data = base64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Reject oversized files (>3 MB decoded)
    if (buffer.length > 3 * 1024 * 1024) {
      return res.status(400).json({ error: 'File too large. Maximum size is 3 MB.' });
    }

    // SVG sanitisation — strip script tags and event handler attributes to prevent XSS
    let finalBuffer = buffer;
    if (mimeMatch[1] === 'image/svg+xml') {
      let svgContent = buffer.toString('utf-8');
      // Remove <script> blocks
      svgContent = svgContent.replace(/<script[\s\S]*?<\/script>/gi, '');
      // Remove on* event handler attributes (onclick, onload, onerror, etc.)
      svgContent = svgContent.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '');
      // Remove javascript: hrefs
      svgContent = svgContent.replace(/href\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, 'href="#"');
      finalBuffer = Buffer.from(svgContent, 'utf-8');
    }

    const uploadsDir = path.join(__dirname, '../../storage/uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Generate a server-controlled filename: sanitise user input but keep extension
    const baseName = path.basename(filename, ext).replace(/[^a-zA-Z0-9\-_]/g, '_');
    const safeFilename = `${baseName}${ext}`;
    const filePath = path.join(uploadsDir, safeFilename);

    // Path traversal guard
    const resolvedPath = path.resolve(filePath);
    const resolvedDir = path.resolve(uploadsDir);
    if (!resolvedPath.startsWith(resolvedDir + path.sep)) {
      return res.status(400).json({ error: 'Invalid filename.' });
    }

    fs.writeFileSync(filePath, finalBuffer);
    res.json({ url: `/uploads/${safeFilename}` });
  } catch {
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/colors — open read
// ---------------------------------------------------------------------------
router.get('/colors', looseLimiter, (_req: Request, res: Response) => {
  try {
    res.json(storage.getColors());
  } catch {
    res.status(500).json({ error: 'Failed to retrieve colors' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/colors — protected write with input validation
// ---------------------------------------------------------------------------
router.put('/colors', standardLimiter, (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const { categories, tags } = body;

    // Validate: both must be plain objects with string keys and string values
    function isColorMap(val: unknown): val is Record<string, string> {
      if (typeof val !== 'object' || val === null || Array.isArray(val)) return false;
      const entries = Object.entries(val as object);
      if (entries.length > 500) return false; // sanity cap
      return entries.every(([k, v]) => typeof k === 'string' && typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v));
    }

    const safeCategories = categories && isColorMap(categories) ? categories : {};
    const safeTags = tags && isColorMap(tags) ? tags : {};

    storage.saveColors({ categories: safeCategories, tags: safeTags });
    res.json({ message: 'Colors saved successfully' });
  } catch {
    res.status(500).json({ error: 'Failed to save colors' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/taxonomy-list — open read
// ---------------------------------------------------------------------------
router.get('/taxonomy-list', looseLimiter, (_req: Request, res: Response) => {
  try {
    const markers = storage.getParsedMarkers();
    const categoriesSet = new Set<string>();
    const tagsSet = new Set<string>();

    markers.forEach(m => {
      if (m.category) categoriesSet.add(m.category);
      if (m.tags && Array.isArray(m.tags)) {
        m.tags.forEach(t => tagsSet.add(t));
      }
    });

    res.json({
      categories: Array.from(categoriesSet),
      tags: Array.from(tagsSet),
    });
  } catch {
    res.status(500).json({ error: 'Failed to retrieve taxonomies' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/sync — protected, strict rate limit
// ---------------------------------------------------------------------------
router.post('/sync', strictLimiter, (_req: Request, res: Response) => {
  try {
    scheduler.sync(true).catch(err => {
      storage.addLog('error', 'Manual sync error', String(err));
    });
    res.json({ message: 'Synchronization triggered in background' });
  } catch {
    res.status(500).json({ error: 'Failed to trigger sync' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/status — protected read (exposes internal state)
// ---------------------------------------------------------------------------
router.get('/status', looseLimiter, (_req: Request, res: Response) => {
  try {
    res.json(storage.getStatus());
  } catch {
    res.status(500).json({ error: 'Failed to retrieve status' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/logs — protected read
// ---------------------------------------------------------------------------
router.get('/logs', looseLimiter, (_req: Request, res: Response) => {
  try {
    res.json(storage.getLogs());
  } catch {
    res.status(500).json({ error: 'Failed to retrieve logs' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/logs — protected write
// ---------------------------------------------------------------------------
router.delete('/logs', standardLimiter, (_req: Request, res: Response) => {
  try {
    storage.clearLogs();
    res.json({ message: 'Logs cleared successfully' });
  } catch {
    res.status(500).json({ error: 'Failed to clear logs' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/export-csv — protected, rate limited
// ---------------------------------------------------------------------------
router.get('/export-csv', looseLimiter, (_req: Request, res: Response) => {
  try {
    const markers = storage.getParsedMarkers();

    if (markers.length === 0) {
      return res.status(404).json({ error: 'No marker data available. Run a sync first.' });
    }

    const csvCell = (val: any): string => {
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = ['ID', 'Title', 'Category', 'Tags', 'Latitude', 'Longitude', 'Has Coordinates', 'URL', 'Image URL'];

    const rows = markers.map(m => [
      csvCell(m.id),
      csvCell(m.title),
      csvCell(m.category || ''),
      csvCell(Array.isArray(m.tags) ? m.tags.join('; ') : ''),
      csvCell(m.latitude !== null ? m.latitude : ''),
      csvCell(m.longitude !== null ? m.longitude : ''),
      csvCell(m.hasCoordinates ? 'Yes' : 'No'),
      csvCell(m.url || ''),
      csvCell(m.imageUrl || ''),
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\r\n');
    const filename = `fcc-maps-export-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv);
  } catch {
    res.status(500).json({ error: 'Failed to generate CSV export' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/mock-wp — dev only
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV !== 'production') {
  router.get('/mock-wp', (_req: Request, res: Response) => {
    const mockPosts = [
      {
        id: 1,
        title: { rendered: 'University of Geneva' },
        link: 'https://www.unige.ch',
        excerpt: { rendered: '<p>46.23307388854503, 6.055512805451645</p>' },
        content: { rendered: '<div>Welcome to the University of Geneva. <p id="website-url"><a href="http://cern.ch">www.cern.ch</a></p></div>' },
        _embedded: {
          'wp:term': [
            [{ id: 10, name: 'Public', taxonomy: 'category' }],
            [{ id: 20, name: 'Switzerland', taxonomy: 'post_tag' }],
          ],
          'wp:featuredmedia': [
            { source_url: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=600&auto=format&fit=crop&q=80' },
          ],
        },
      },
      {
        id: 2,
        title: { rendered: 'University of Zurich' },
        link: 'https://www.uzh.ch',
        excerpt: { rendered: '<p>47.3762898, 8.540212</p>' },
        content: { rendered: '<div>Zurich University provides world-class education. <p id="website-url">www.uzh.ch</p></div>' },
        _embedded: {
          'wp:term': [
            [{ id: 10, name: 'Public', taxonomy: 'category' }],
            [{ id: 20, name: 'Switzerland', taxonomy: 'post_tag' }],
          ],
          'wp:featuredmedia': [
            { source_url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=600&auto=format&fit=crop&q=80' },
          ],
        },
      },
      {
        id: 5,
        title: { rendered: 'Invalid Coordinates University' },
        link: 'https://example.com/invalid',
        excerpt: { rendered: '<p>95.0, 195.0</p>' },
      },
      {
        id: 6,
        title: { rendered: 'Missing Coordinates University' },
        link: 'https://example.com/missing',
        excerpt: { rendered: '<p>No coordinates here.</p>' },
      },
    ];

    res.json(mockPosts);
  });
}

export default router;
