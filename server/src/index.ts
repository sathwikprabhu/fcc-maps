import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import apiRouter from './routes/routes';
import { scheduler } from './scheduler/scheduler';
import { storage } from './services/storage';

dotenv.config();

// NOTE: TLS bypass was here — removed. Use per-request agent in scheduler instead.

const app = express();
const PORT = process.env.PORT || 5050;

// Restrict CORS to same-origin and known embed origins
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type'],
}));

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

// Serve embed page and admin dashboard statically from the root public directory
const publicPath = path.join(__dirname, '../../public');
app.use(express.static(publicPath));

// Serve dynamic markers.json and uploaded files statically from the storage directory
const storagePath = path.join(__dirname, '../storage');
app.use(express.static(storagePath));

// Fallback for SPA routing if admin dashboard is built into public/admin
app.get('/admin', (req, res) => {
  res.redirect('/admin/');
});
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(publicPath, 'admin/index.html'));
});

// Start server
const server = app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  storage.addLog('info', `Web server started on port ${PORT}`);
  
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
