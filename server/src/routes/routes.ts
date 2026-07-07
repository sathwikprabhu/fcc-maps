import { Router, Request, Response } from 'express';
import { storage } from '../services/storage';
import { scheduler } from '../scheduler/scheduler';
import { Settings } from '../types';
import fs from 'fs';
import path from 'path';

const router = Router();

// GET /api/settings
router.get('/settings', (req: Request, res: Response) => {
  try {
    const settings = storage.getSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve settings' });
  }
});

// PUT /api/settings
router.put('/settings', (req: Request, res: Response) => {
  try {
    const newSettings: Settings = req.body;

    if (!newSettings.wpApiUrl) {
      return res.status(400).json({ error: 'WordPress API URL is required' });
    }

    // Basic URL validation
    try {
      new URL(newSettings.wpApiUrl);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid WordPress API URL format' });
    }

    if (typeof newSettings.syncIntervalHours !== 'number' || newSettings.syncIntervalHours <= 0) {
      return res.status(400).json({ error: 'Sync interval must be a positive number' });
    }

    // Save settings
    storage.saveSettings(newSettings);
    
    // Reschedule jobs with new frequency
    scheduler.reschedule();

    res.json({ message: 'Settings saved successfully', settings: newSettings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// POST /api/upload-logo
router.post('/upload-logo', (req: Request, res: Response) => {
  try {
    const { filename, base64 } = req.body;
    if (!filename || !base64) {
      return res.status(400).json({ error: 'Filename and base64 data are required' });
    }

    const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    const uploadsDir = path.join(__dirname, '../../storage/uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const safeFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const filePath = path.join(uploadsDir, safeFilename);

    fs.writeFileSync(filePath, buffer);
    res.json({ url: `/uploads/${safeFilename}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

// GET /api/colors
router.get('/colors', (req: Request, res: Response) => {
  try {
    res.json(storage.getColors());
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve colors' });
  }
});

// PUT /api/colors
router.put('/colors', (req: Request, res: Response) => {
  try {
    const { categories, tags } = req.body;
    storage.saveColors({ categories: categories || {}, tags: tags || {} });
    res.json({ message: 'Colors saved successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save colors' });
  }
});

// GET /api/taxonomy-list
router.get('/taxonomy-list', (req: Request, res: Response) => {
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
      tags: Array.from(tagsSet)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve taxonomies' });
  }
});

// POST /api/sync
router.post('/sync', (req: Request, res: Response) => {
  try {
    // Run sync in the background so request completes instantly
    scheduler.sync(true).catch(err => {
      storage.addLog('error', 'Manual sync error', String(err));
    });
    
    res.json({ message: 'Synchronization triggered in background' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to trigger sync' });
  }
});

// GET /api/status
router.get('/status', (req: Request, res: Response) => {
  try {
    const status = storage.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve status' });
  }
});

// GET /api/logs
router.get('/logs', (req: Request, res: Response) => {
  try {
    const logs = storage.getLogs();
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve logs' });
  }
});

// DELETE /api/logs (Clear logs)
router.delete('/logs', (req: Request, res: Response) => {
  try {
    storage.clearLogs();
    res.json({ message: 'Logs cleared successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear logs' });
  }
});

// GET /api/mock-wp (Mock WordPress JSON API endpoint)
router.get('/mock-wp', (req: Request, res: Response) => {
  const mockPosts = [
    {
      id: 1,
      title: { rendered: "University of Geneva" },
      link: "https://www.unige.ch",
      excerpt: { rendered: "<p>46.23307388854503, 6.055512805451645</p>" },
      content: { rendered: "<div>Welcome to the University of Geneva. Check out our CERN projects! <p id=\"website-url\"><a href=\"http://cern.ch\">www.cern.ch</a></p></div>" },
      _embedded: {
        "wp:term": [
          [
            { id: 10, name: "Public", taxonomy: "category" }
          ],
          [
            { id: 20, name: "Switzerland", taxonomy: "post_tag" }
          ]
        ],
        "wp:featuredmedia": [
          { source_url: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=600&auto=format&fit=crop&q=80" }
        ]
      }
    },
    {
      id: 2,
      title: { rendered: "University of Zurich" },
      link: "https://www.uzh.ch",
      excerpt: { rendered: "<p>47.3762898, 8.540212</p>" },
      content: { rendered: "<div>Zurich University provides world-class education. <p id=\"website-url\">www.uzh.ch</p></div>" },
      _embedded: {
        "wp:term": [
          [
            { id: 10, name: "Public", taxonomy: "category" }
          ],
          [
            { id: 20, name: "Switzerland", taxonomy: "post_tag" }
          ]
        ],
        "wp:featuredmedia": [
          { source_url: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=600&auto=format&fit=crop&q=80" }
        ]
      }
    },
    {
      id: 3,
      title: { rendered: "University of Tokyo" },
      link: "https://www.u-tokyo.ac.jp",
      excerpt: { rendered: "<p>35.712678, 139.761989</p>" },
      _embedded: {
        "wp:term": [
          [
            { id: 11, name: "National", taxonomy: "category" }
          ],
          [
            { id: 21, name: "Japan", taxonomy: "post_tag" }
          ]
        ],
        "wp:featuredmedia": [
          { source_url: "https://images.unsplash.com/photo-1592280771190-3e2e4d571952?w=600&auto=format&fit=crop&q=80" }
        ]
      }
    },
    {
      id: 4,
      title: { rendered: "University of Oxford" },
      link: "https://www.ox.ac.uk",
      excerpt: { rendered: "<p>51.754816, -1.254367</p>" },
      _embedded: {
        "wp:term": [
          [
            { id: 10, name: "Public", taxonomy: "category" }
          ],
          [
            { id: 22, name: "United Kingdom", taxonomy: "post_tag" }
          ]
        ],
        "wp:featuredmedia": [
          { source_url: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&auto=format&fit=crop&q=80" }
        ]
      }
    },
    {
      id: 5,
      title: { rendered: "Invalid Coordinates University" },
      link: "https://example.com/invalid",
      excerpt: { rendered: "<p>95.0, 195.0</p>" }
    },
    {
      id: 6,
      title: { rendered: "Missing Coordinates University" },
      link: "https://example.com/missing",
      excerpt: { rendered: "<p>This is a beautiful university, but we forgot to add its coordinates in this excerpt.</p>" }
    },
    {
      id: 7,
      title: { rendered: "Duplicate Coordinates University (Geneva)" },
      link: "https://example.com/duplicate",
      excerpt: { rendered: "<p>46.23307388854503, 6.055512805451645</p>" }
    }
  ];

  res.json(mockPosts);
});

export default router;
