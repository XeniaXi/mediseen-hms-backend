import express, { Application } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import * as Sentry from '@sentry/node';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { auditMiddleware } from './middleware/auditMiddleware';
import { prisma } from './db';
import { initializeSocket } from './socket';
import 'dotenv/config';

// Initialize Sentry for error monitoring
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
  console.log('✅ Sentry initialized');
}

const app: Application = express();
const PORT = process.env.PORT || 5000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// Middleware
app.use(
  cors({
    origin: CORS_ORIGIN.split(',').map(s => s.trim()),
    credentials: true,
  })
);
app.use(helmet());
app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per windowMs — stricter for auth endpoints
  message: 'Too many authentication attempts, please try again later',
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per windowMs
  message: 'Too many requests, please try again later',
});

// Apply rate limiting
app.use('/api/v1/auth', authLimiter);
app.use('/api/v1', generalLimiter);

// Audit middleware (logs mutations)
app.use(auditMiddleware);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/v1', routes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler (must be last)
app.use(errorHandler);

// Graceful shutdown
const shutdown = async () => {
  console.log('\nShutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Create HTTP server for Express + WebSocket
const httpServer = createServer(app);

// Initialize WebSocket server
const io = initializeSocket(httpServer);

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected');

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔐 CORS enabled for: ${CORS_ORIGIN}`);
      console.log(`🔌 WebSocket server ready`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export { io };
export default app;
