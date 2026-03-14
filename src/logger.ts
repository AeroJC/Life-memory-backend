import crypto from 'crypto'

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogEntry {
  level: LogLevel
  msg: string
  timestamp: string
  requestId?: string
  [key: string]: any
}

function log(level: LogLevel, msg: string, data?: Record<string, any>) {
  const entry: LogEntry = {
    level,
    msg,
    timestamp: new Date().toISOString(),
    ...data,
  }
  const output = JSON.stringify(entry)
  if (level === 'error') {
    process.stderr.write(output + '\n')
  } else {
    process.stdout.write(output + '\n')
  }
}

export const logger = {
  info: (msg: string, data?: Record<string, any>) => log('info', msg, data),
  warn: (msg: string, data?: Record<string, any>) => log('warn', msg, data),
  error: (msg: string, data?: Record<string, any>) => log('error', msg, data),
  debug: (msg: string, data?: Record<string, any>) => {
    if (process.env.NODE_ENV !== 'production') log('debug', msg, data)
  },
}

export function generateRequestId(): string {
  return crypto.randomBytes(8).toString('hex')
}
