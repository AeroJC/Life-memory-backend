import { Request, Response, NextFunction } from 'express'

/** Strip HTML tags from a string to prevent XSS */
function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '')
}

/** Recursively sanitize string values in an object */
function sanitizeValue(value: any): any {
  if (typeof value === 'string') return stripHtml(value)
  if (Array.isArray(value)) return value.map(sanitizeValue)
  if (value && typeof value === 'object') {
    const result: any = {}
    for (const key of Object.keys(value)) {
      result[key] = sanitizeValue(value[key])
    }
    return result
  }
  return value
}

/**
 * Middleware to sanitize request body strings.
 * Skips fields listed in the `except` set (e.g., 'story', 'content', 'caption'
 * which may contain intentional rich text HTML from the editor).
 */
export function sanitizeBody(except: Set<string> = new Set()) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.body && typeof req.body === 'object') {
      for (const key of Object.keys(req.body)) {
        if (!except.has(key)) {
          req.body[key] = sanitizeValue(req.body[key])
        }
      }
    }
    next()
  }
}
