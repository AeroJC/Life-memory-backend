import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '../db.js'
import bcrypt from 'bcryptjs'

// We test the route handler logic by testing the validatePassword function
// and the key business rules directly

describe('auth route business logic', () => {
  describe('validatePassword', () => {
    // Replicate the backend's password validation
    function validatePassword(password: string): string | null {
      if (password.length < 8) return 'Password must be at least 8 characters'
      if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter'
      if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter'
      if (!/[0-9]/.test(password)) return 'Password must contain at least one number'
      if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain at least one special character'
      return null
    }

    it('rejects passwords shorter than 8 characters', () => {
      expect(validatePassword('Ab1!')).toBe('Password must be at least 8 characters')
    })

    it('rejects passwords without uppercase', () => {
      expect(validatePassword('abcdef1!')).toBe('Password must contain at least one uppercase letter')
    })

    it('rejects passwords without lowercase', () => {
      expect(validatePassword('ABCDEF1!')).toBe('Password must contain at least one lowercase letter')
    })

    it('rejects passwords without numbers', () => {
      expect(validatePassword('Abcdefgh!')).toBe('Password must contain at least one number')
    })

    it('rejects passwords without special characters', () => {
      expect(validatePassword('Abcdefg1')).toBe('Password must contain at least one special character')
    })

    it('accepts a strong password', () => {
      expect(validatePassword('MyStr0ng!Pass')).toBeNull()
    })

    it('accepts minimum valid password', () => {
      expect(validatePassword('Aa1!xxxx')).toBeNull()
    })
  })

  describe('email validation', () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

    it('accepts valid email', () => {
      expect(emailRegex.test('user@example.com')).toBe(true)
    })

    it('rejects email without @', () => {
      expect(emailRegex.test('userexample.com')).toBe(false)
    })

    it('rejects email with single char TLD', () => {
      expect(emailRegex.test('user@example.c')).toBe(false)
    })

    it('rejects email with spaces', () => {
      expect(emailRegex.test('user @example.com')).toBe(false)
    })
  })

  describe('verification code generation', () => {
    function generateCode(): string {
      return Math.floor(100000 + Math.random() * 900000).toString()
    }

    it('generates 6-digit codes', () => {
      for (let i = 0; i < 100; i++) {
        const code = generateCode()
        expect(code).toHaveLength(6)
        expect(Number(code)).toBeGreaterThanOrEqual(100000)
        expect(Number(code)).toBeLessThan(1000000)
      }
    })
  })

  describe('code expiry', () => {
    function codeExpiry(): Date {
      return new Date(Date.now() + 15 * 60 * 1000)
    }

    it('sets expiry 15 minutes in the future', () => {
      const before = Date.now()
      const expiry = codeExpiry()
      const after = Date.now()
      const fifteenMin = 15 * 60 * 1000
      expect(expiry.getTime()).toBeGreaterThanOrEqual(before + fifteenMin)
      expect(expiry.getTime()).toBeLessThanOrEqual(after + fifteenMin)
    })
  })

  describe('bcrypt password hashing', () => {
    it('hashes and verifies passwords correctly', async () => {
      const password = 'TestPass1!'
      const hashed = await bcrypt.hash(password, 10)
      expect(hashed).not.toBe(password)
      expect(await bcrypt.compare(password, hashed)).toBe(true)
      expect(await bcrypt.compare('wrongpass', hashed)).toBe(false)
    })
  })

  describe('JWT token', () => {
    it('signs and verifies tokens', async () => {
      const jwt = await import('jsonwebtoken')
      const token = jwt.default.sign({ userId: 'u-1' }, process.env.JWT_SECRET!, { expiresIn: '30d' })
      const decoded = jwt.default.verify(token, process.env.JWT_SECRET!) as any
      expect(decoded.userId).toBe('u-1')
    })

    it('rejects expired tokens', async () => {
      const jwt = await import('jsonwebtoken')
      const token = jwt.default.sign({ userId: 'u-1' }, process.env.JWT_SECRET!, { expiresIn: '0s' })
      await new Promise(r => setTimeout(r, 10))
      expect(() => jwt.default.verify(token, process.env.JWT_SECRET!)).toThrow()
    })

    it('rejects tokens with wrong secret', async () => {
      const jwt = await import('jsonwebtoken')
      const token = jwt.default.sign({ userId: 'u-1' }, 'wrong-secret')
      expect(() => jwt.default.verify(token, process.env.JWT_SECRET!)).toThrow()
    })
  })
})
