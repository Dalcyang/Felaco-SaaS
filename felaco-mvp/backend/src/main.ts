import 'reflect-metadata';
import { createConnection } from 'typeorm';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { useExpressServer } from 'routing-controllers';
import { createClient } from 'redis';
import { logger } from './common/logger';
import { errorHandler } from './middleware/error.middleware';
import { authChecker } from './auth/auth.checker';
import { currentUserChecker } from './auth/current-user.checker';
import { User } from './entity/User';
import { Site } from './entity/Site';
import { AICredits } from './entity/AICredits';
import { Payment } from './entity/Payment';

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

// Create Express server
const app = express();
const server = createServer(app);

// Initialize Redis client
export const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379'
});

// Connect to Redis
redisClient.on('error', (err) => logger.error('Redis Client Error', err));
redisClient.connect().then(() => {
  logger.info('Connected to Redis');
}).catch(err => {
  logger.error('Failed to connect to Redis', err);
  process.exit(1);
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',').map(origin => origin.trim()) || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize database connection
createConnection({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV !== 'production',
  entities: [User, Site, AICredits, Payment],
  migrations: ['src/migration/**/*.ts'],
  subscribers: [],
  migrationsRun: true,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  extra: {
    connectionLimit: 5,
  },
}).then(async (connection) => {
  logger.info('Database connection established');
  
  // Initialize routing controllers
  useExpressServer(app, {
    routePrefix: '/api',
    controllers: [__dirname + '/controllers/*.ts'],
    middlewares: [__dirname + '/middleware/*.ts'],
    interceptors: [__dirname + '/interceptors/*.ts'],
    defaultErrorHandler: false,
    classTransformer: true,
    validation: true,
    authorizationChecker: authChecker,
    currentUserChecker: currentUserChecker,
  });

  // Error handling middleware (must be after all other middleware and routes)
  app.use(errorHandler);

  // Start the server
  const port = process.env.PORT || 4000;
  server.listen(port, () => {
    logger.info(`Server is running on port ${port}`);
    
    // Create admin user if it doesn't exist
    if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
      // This would be implemented in a separate admin service
      logger.info(`Admin email: ${process.env.ADMIN_EMAIL}`);
    }
  });
}).catch(error => {
  logger.error('Database connection failed', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Consider restarting the server or handling the error appropriately
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // Consider restarting the server or handling the error appropriately
  process.exit(1);
});

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down server...');
  
  try {
    await redisClient.quit();
    logger.info('Redis client disconnected');
  } catch (error) {
    logger.error('Error disconnecting from Redis', error);
  }
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { app };
