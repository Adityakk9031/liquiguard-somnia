import winston from 'winston';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  meta?: Record<string, unknown>;
}

// In-memory ring buffer for streaming/querying logs via REST API
const MAX_IN_MEMORY_LOGS = 500;
const memoryLogs: LogEntry[] = [];

// Custom format for memory capture
const memoryFormat = winston.format((info) => {
  const { timestamp, level, message, ...meta } = info;
  const entry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    timestamp: (timestamp as string) || new Date().toISOString(),
    level,
    message: typeof message === 'string' ? message : JSON.stringify(message),
    meta: Object.keys(meta).length > 0 ? meta : undefined,
  };

  memoryLogs.push(entry);
  if (memoryLogs.length > MAX_IN_MEMORY_LOGS) {
    memoryLogs.shift();
  }

  return info;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    memoryFormat(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'liquiguard-sentinel' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
          const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `[${timestamp}] [${level}] [${service}]: ${message}${metaString}`;
        })
      ),
    }),
  ],
});

export function getRecentLogs(limit = 100): LogEntry[] {
  const count = Math.min(limit, memoryLogs.length);
  return memoryLogs.slice(memoryLogs.length - count);
}

export function clearLogs(): void {
  memoryLogs.length = 0;
}
