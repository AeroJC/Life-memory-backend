import { Request, Response, NextFunction } from 'express'

/**
 * Extends Express Response with consistent success/error helpers.
 * Apply as middleware: app.use(responseHelpers)
 * Usage: res.apiSuccess(data) or res.apiError('message', 400)
 *
 * Note: Not yet applied to existing routes — available for new routes
 * and gradual migration. Existing routes use mixed formats.
 */
export function responseHelpers(_req: Request, res: Response, next: NextFunction) {
  res.apiSuccess = function (data?: unknown, status = 200) {
    this.status(status).json({ success: true, data })
  }

  res.apiError = function (message: string, status = 400) {
    this.status(status).json({ success: false, error: message })
  }

  next()
}

// Extend Express Response type
declare global {
  namespace Express {
    interface Response {
      apiSuccess: (data?: unknown, status?: number) => void
      apiError: (message: string, status?: number) => void
    }
  }
}
