import { EventEmitter } from 'events'

/**
 * In-memory pub/sub for real-time notification delivery via SSE.
 * Events are keyed per user: `notify:<userId>`
 */
export const notificationBus = new EventEmitter()

// Each connected SSE client adds a listener — no artificial cap
notificationBus.setMaxListeners(0)
