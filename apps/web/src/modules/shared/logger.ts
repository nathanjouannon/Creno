// JSON logs on stdout (security.md, section 4): request id, user id, never a password, token or full e-mail.
import { clock } from './clock';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const SECRET_KEY = /pass(word|wd)|token|secret|authorization|cookie|session/i;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** `alice@club.fr` → `a***@c***.fr` */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return '***';
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  const host = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : '';
  return `${email[0]}***@${host[0] ?? ''}***${tld}`;
}

function redactString(value: string): string {
  return value.replace(EMAIL, (match) => maskEmail(match));
}

/** Copy of a value where secrets are replaced and every e-mail address is masked, at any depth. */
export function redact(value: unknown, key = '', depth = 0): unknown {
  if (SECRET_KEY.test(key)) return '[redacted]';
  if (typeof value === 'string')
    return /e-?mail$/i.test(key) ? maskEmail(value) : redactString(value);
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      stack: redactString(value.stack ?? ''),
    };
  }
  if (value instanceof Date) return value.toISOString();
  if (depth >= 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, key, depth + 1));
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redact(v, k, depth + 1)]));
}

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
}

interface LoggerOptions {
  level?: LogLevel;
  write?: (line: string) => void;
  bindings?: Record<string, unknown>;
}

export function createLogger({ level = 'info', write, bindings = {} }: LoggerOptions = {}): Logger {
  const out = write ?? ((line: string) => void process.stdout.write(`${line}\n`));
  const log = (at: LogLevel, msg: string, fields: Record<string, unknown> = {}) => {
    if (LEVEL_ORDER[at] < LEVEL_ORDER[level]) return;
    const entry = redact({
      level: at,
      time: clock.now().toISOString(),
      msg,
      ...bindings,
      ...fields,
    });
    out(JSON.stringify(entry));
  };
  return {
    debug: (msg, fields) => log('debug', msg, fields),
    info: (msg, fields) => log('info', msg, fields),
    warn: (msg, fields) => log('warn', msg, fields),
    error: (msg, fields) => log('error', msg, fields),
    child: (fields) => createLogger({ level, write, bindings: { ...bindings, ...fields } }),
  };
}

const LEVELS = Object.keys(LEVEL_ORDER);

let shared: Logger | undefined;

/** Process-wide logger; the level comes from LOG_LEVEL (environments.md, section 2). */
export function getLogger(): Logger {
  const env = process.env.LOG_LEVEL;
  shared ??= createLogger({ level: env && LEVELS.includes(env) ? (env as LogLevel) : 'info' });
  return shared;
}
