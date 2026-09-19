import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { eventsRouter } from './routes/events';
import { recommendationsRouter } from './routes/recommendations';
import { userRouter } from './routes/user';
import { feedbackRouter } from './routes/feedback';
import { supabase, supabaseAdmin } from './supabaseClient';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
  'http://localhost:3000',
  'chrome-extension://'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(o => origin.startsWith(o))) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json());

// Health Check (Public availability & database connectivity verification)
const healthHandler = async (_req: express.Request, res: express.Response): Promise<void> => {
  let dbStatus = 'healthy';
  try {
    const dbClient = supabaseAdmin || supabase;
    const { error } = await dbClient.from('users').select('count', { count: 'exact', head: true });
    if (error) dbStatus = 'degraded: ' + error.message;
  } catch (err: any) {
    dbStatus = 'unhealthy: ' + err.message;
  }

  const isHealthy = !dbStatus.startsWith('unhealthy');
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    service: 'SARA Backend API',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    authConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY),
    environment: process.env.NODE_ENV || 'development'
  });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// Protected API Routes
app.use('/api/events', eventsRouter);
app.use('/api/recommendations', recommendationsRouter);
app.use('/api/user', userRouter);
app.use('/api/feedback', feedbackRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('Unhandled server error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`SARA Backend API running on http://localhost:${PORT}`);
});
