import { utilities as nestWinstonModuleUtilities, WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';
import { AppInsightsTransport } from '../common/logger/app-insights.winston-transport';

export function buildWinstonConfig(appName = 'ProductsService'): WinstonModuleOptions {
  const isDev = process.env.NODE_ENV !== 'production';

  const devFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    nestWinstonModuleUtilities.format.nestLike(appName, {
      prettyPrint: true,
      colors: true,
    }),
  );

  const prodFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  );

  return {
    transports: [
      new winston.transports.Console({
        format: isDev ? devFormat : prodFormat,
        level: process.env.LOG_LEVEL ?? 'debug',
      }),
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json(),
        ),
        maxsize: 10 * 1024 * 1024, // 10 MB
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json(),
        ),
        maxsize: 20 * 1024 * 1024, // 20 MB
        maxFiles: 10,
      }),
      // Reenvía cada log a Application Insights con serviceName + userId.
      // No-op si APPLICATIONINSIGHTS_CONNECTION_STRING no está presente (local).
      new AppInsightsTransport({ level: process.env.LOG_LEVEL ?? 'debug' }),
    ],
    exitOnError: false,
  };
}
