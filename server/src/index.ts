import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import apiRouter from './routes/routes';
import { scheduler } from './scheduler/scheduler';
import { storage } from './services/storage';

dotenv.config();

// ---------------------------------------------------------------------------
// Startup: validate critical environment variables and warn on misconfigurations
// ---------------------------------------------------------------------------
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  if (!process.env.ADMIN_API_KEY) {
    console.warn('[WARN] ADMIN_API_KEY is not set. All protected admin API routes will return 503.');
  }
  if (!process.env.ALLOWED_ORIGINS) {
    console.warn('[WARN] ALLOWED_ORIGINS is not set. Cross-origin requests from external sites will be blocked.');
  }
}

// ---------------------------------------------------------------------------
// Unhandled promise rejections — log and keep process alive
// ---------------------------------------------------------------------------
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled promise rejection:', reason);
  storage.addLog('error', 'Unhandled promise rejection', String(reason));
});

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err);
  storage.addLog('error', 'Uncaught exception', String(err));
});

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------
const app = express();
const PORT = process.env.PORT || 5050;

// Remove X-Powered-By and add security headers via Helmet.
// Cross-origin-embedder / opener policies are relaxed to allow the Leaflet
// map embed to load tiles from third-party CDNs.
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  contentSecurityPolicy: false, // CSP managed separately if needed
}));

// ---------------------------------------------------------------------------
// Static files — served BEFORE CORS so admin assets bypass CORS entirely.
// Same-origin static files never need CORS headers.
// ---------------------------------------------------------------------------
const publicPath = path.join(__dirname, '../../public');
app.use(express.static(publicPath));

// ---------------------------------------------------------------------------
// CORS — applied to API routes only (static files are served above).
// ---------------------------------------------------------------------------
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [];

const corsMiddleware = cors({
  // Reflect back only explicitly listed origins
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, origin ?? '*');
    } else {
      callback(null, false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;

  // No Origin header → not a browser cross-origin request
  if (!origin) return next();

  // Same-origin check: compare Origin host with Host header
  try {
    const originHost = new URL(origin).host;
    if (originHost === req.headers.host) return next();
  } catch {
    // Malformed Origin — fall through to CORS
  }

  // Apply CORS for cross-origin requests
  corsMiddleware(req, res, next);
});

// ---------------------------------------------------------------------------
// Body parsing (tight global limit; upload routes set their own limit)
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '100kb' }));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).send('OK');
});
app.get('/', (_req: Request, res: Response) => {
  res.status(200).send('FCC Maps Server is running');
});

app.use('/api', apiRouter);

// ---------------------------------------------------------------------------
// Storage-backed routes
// ---------------------------------------------------------------------------
const storagePath = path.join(__dirname, '../storage');

app.get('/markers.json', (_req: Request, res: Response) => {
  const markersFile = path.join(storagePath, 'markers.json');
  if (!fs.existsSync(markersFile)) {
    return res.json([]);
  }
  res.sendFile(markersFile);
});

app.use('/uploads', express.static(path.join(storagePath, 'uploads')));

// ---------------------------------------------------------------------------
// SPA fallback — admin routes only; asset requests (with extensions) get 404
// ---------------------------------------------------------------------------
app.get('/admin', (_req: Request, res: Response) => {
  res.redirect('/admin/');
});
app.get('/admin/*', (req: Request, res: Response) => {
  const ext = path.extname(req.path);
  if (ext && ext !== '.html') {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(publicPath, 'admin/index.html'));
});

// ---------------------------------------------------------------------------
// Global error handler — never expose stack traces to clients
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: 'An internal server error occurred.' });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const server = app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  storage.addLog('info', `Web server started on port ${PORT}`);

  const adminAssetsPath = path.join(publicPath, 'admin/assets');
  if (fs.existsSync(adminAssetsPath)) {
    const files = fs.readdirSync(adminAssetsPath);
    console.log(`[OK] Admin assets found (${files.length} files): ${adminAssetsPath}`);
  } else {
    console.warn(`[WARN] Admin assets NOT found at: ${adminAssetsPath}`);
    console.warn(`[WARN] publicPath resolves to: ${publicPath}`);
  }

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
