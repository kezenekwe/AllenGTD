import winston from 'winston';
import { config } from './env';

const { combine, timestamp, json, colorize, printf } = winston.format;

// ─── Formats ──────────────────────────────────────────────────────────────

const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  printf(({ level, message, timestamp: ts, ...meta }) => {
    const extras = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `${ts} [${level}] ${message}${extras}`;
  }),
);

const prodFormat = combine(
  timestamp(),
  json(),
);

// ─── Logger ───────────────────────────────────────────────────────────────

export const logger = winston.createLogger({
  level: config.log.level,
  format: config.isProd ? prodFormat : devFormat,
  transports: [new winston.transports.Console()],
});

// Add log levels above 'http' so HTTP-level log appears at the right verbosity
winston.addColors({ http: 'magenta' });

export default logger;
