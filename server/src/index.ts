import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import apiRouter from './routes/routes';
import { scheduler } from './scheduler/scheduler';
import { storage } from './services/storage';

dotenv.config();

// NOTE: TLS bypass was here — removed. Use per-request agent in scheduler instead.

const app = express();
const PORT = process.env.PORT || 5050;

// Serve static files FIRST, before CORS — admin assets (JS/CSS bundles),
// embed files, etc. are same-origin requests that don't need CORS headers.
const publicPath = path.join(__dirname, '../../public');
app.use(express.static(publicPath));

// Restrict CORS to same-origin and known embed origins
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [];

const isProduction = process.env.NODE_ENV === 'production';

// CORS middleware with same-origin detection.
// The admin panel is served from the same origin as the API, but browsers
// still send an Origin header on fetch() requests. We detect same-origin
// by comparing Origin against the Host header and always allow those.
const corsMiddleware = cors({
  origin: true, // reflect the request origin (used only when we call next)
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type'],
});

app.use((req, res, next) => {
  const origin = req.headers.origin;
  // No Origin header → not a browser cross-origin request, allow
  if (!origin) return next();

  // Same-origin check: extract hostname from Origin and compare with Host header
  try {
    const originHost = new URL(origin).host;
    const requestHost = req.headers.host;
    if (originHost === requestHost) {
      // Same-origin request (e.g. admin panel calling API) — skip CORS
      return next();
    }
  } catch {
    // Malformed Origin — fall through to CORS check
  }

  // Explicitly allowed origins
  if (allowedOrigins.includes(origin)) {
    return corsMiddleware(req, res, next);
  }

  // In production with no ALLOWED_ORIGINS, deny unknown cross-origin requests
  if (isProduction && allowedOrigins.length === 0) {
    return res.status(403).json({ error: 'CORS: origin not allowed' });
  }

  // Dev mode with no ALLOWED_ORIGINS — allow everything
  return corsMiddleware(req, res, next);
});

// Tight body size for API requests; upload route has its own higher limit
app.use(express.json({ limit: '100kb' }));

// Log incoming API requests in storage for tracking
app.use('/api', (req, res, next) => {
  next();
});

// Health Check
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});
app.get('/', (req, res) => {
  res.status(200).send('FCC Maps Server is running');
});

// API Routes
app.use('/api', apiRouter);

// Serve ONLY markers.json and uploads/ from storage root.
// Sensitive files (settings, logs, status, colors) live in storage/config/
// which is a private subdirectory that is never served here.
const storagePath = path.join(__dirname, '../storage');

// Only serve markers.json publicly
app.get('/markers.json', (req, res) => {
  const markersFile = path.join(storagePath, 'markers.json');
  if (!fs.existsSync(markersFile)) {
    return res.json([]); // Return empty array before first sync
  }
  res.sendFile(markersFile);
});

// Only serve uploaded files (logos, favicons) publicly
app.use('/uploads', express.static(path.join(storagePath, 'uploads')));

// Fallback for SPA routing — serve index.html for admin navigation routes only.
// Asset requests (.js, .css, images etc.) are NOT caught here; they get a 404
// rather than receiving HTML which breaks the browser's MIME type check.
app.get('/admin', (req, res) => {
  res.redirect('/admin/');
});
app.get('/admin/*', (req, res) => {
  const ext = path.extname(req.path);
  // If the request has a file extension, it's an asset — don't serve index.html
  if (ext && ext !== '.html') {
    return res.status(404).send('Not found');
  }
  res.sendFile(path.join(publicPath, 'admin/index.html'));
});

// Start server
const server = app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  storage.addLog('info', `Web server started on port ${PORT}`);

  // Diagnostic: confirm admin assets are present in the container
  const adminAssetsPath = path.join(publicPath, 'admin/assets');
  if (fs.existsSync(adminAssetsPath)) {
    const files = fs.readdirSync(adminAssetsPath);
    console.log(`[OK] Admin assets found (${files.length} files): ${adminAssetsPath}`);
  } else {
    console.warn(`[WARN] Admin assets NOT found at: ${adminAssetsPath}`);
    console.warn(`[WARN] publicPath resolves to: ${publicPath}`);
  }
  
  // Start the background scheduler
  scheduler.start();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  scheduler.stop();
  server.close(() => {
    console.log('HTTP server closed');
  });
});
