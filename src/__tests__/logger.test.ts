import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logger, generateRequestId } from '../logger.js'

describe('logger', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>
  let stderrSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    stdoutSpy.mockRestore()
    stderrSpy.mockRestore()
  })

  it('logs info messages to stdout', () => {
    logger.info('test message', { key: 'value' })
    expect(stdoutSpy).toHaveBeenCalledOnce()
    const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string)
    expect(output.level).toBe('info')
    expect(output.msg).toBe('test message')
    expect(output.key).toBe('value')
    expect(output.timestamp).toBeDefined()
  })

  it('logs warn messages to stdout', () => {
    logger.warn('warning')
    expect(stdoutSpy).toHaveBeenCalledOnce()
    const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string)
    expect(output.level).toBe('warn')
  })

  it('logs error messages to stderr', () => {
    logger.error('error msg', { code: 500 })
    expect(stderrSpy).toHaveBeenCalledOnce()
    const output = JSON.parse(stderrSpy.mock.calls[0][0] as string)
    expect(output.level).toBe('error')
    expect(output.msg).toBe('error msg')
    expect(output.code).toBe(500)
  })

  it('logs debug only in non-production', () => {
    const origEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'test'
    logger.debug('debug msg')
    expect(stdoutSpy).toHaveBeenCalledOnce()
    process.env.NODE_ENV = origEnv
  })

  it('suppresses debug in production', () => {
    const origEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    logger.debug('should not appear')
    expect(stdoutSpy).not.toHaveBeenCalled()
    process.env.NODE_ENV = origEnv
  })
})

describe('generateRequestId', () => {
  it('returns a 16-character hex string', () => {
    const id = generateRequestId()
    expect(id).toMatch(/^[0-9a-f]{16}$/)
  })

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateRequestId()))
    expect(ids.size).toBe(100)
  })
})
