type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m', // cyan
  info: '\x1b[32m',  // green
  warn: '\x1b[33m',  // yellow
  error: '\x1b[31m', // red
};

const RESET = '\x1b[0m';

let minLevel: LogLevel = 'info';

function formatTimestamp(): string {
  return new Date().toISOString();
}

function log(level: LogLevel, context: string, message: string, data?: unknown): void {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[minLevel]) return;

  const timestamp = formatTimestamp();
  const color = LEVEL_COLORS[level];
  const prefix = `${color}[${timestamp}] [${level.toUpperCase()}] [${context}]${RESET}`;

  if (data !== undefined) {
    console.log(prefix, message, data);
  } else {
    console.log(prefix, message);
  }
}

export const logger = {
  setLevel(level: LogLevel) {
    minLevel = level;
  },

  debug(context: string, message: string, data?: unknown) {
    log('debug', context, message, data);
  },

  info(context: string, message: string, data?: unknown) {
    log('info', context, message, data);
  },

  warn(context: string, message: string, data?: unknown) {
    log('warn', context, message, data);
  },

  error(context: string, message: string, data?: unknown) {
    log('error', context, message, data);
  },
};
