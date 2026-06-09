import { describe, it, expect } from 'vitest'
import { sanitize } from '@/lib/sanitize'

describe('sanitize', () => {
  describe('allowed tags are preserved', () => {
    it('keeps <b> tag', () => {
      expect(sanitize('Hello <b>world</b>')).toBe('Hello <b>world</b>')
    })

    it('keeps <strong> tag', () => {
      expect(sanitize('Hello <strong>world</strong>')).toBe('Hello <strong>world</strong>')
    })

    it('keeps <em> tag', () => {
      expect(sanitize('Hello <em>world</em>')).toBe('Hello <em>world</em>')
    })

    it('keeps <i> tag', () => {
      expect(sanitize('Hello <i>world</i>')).toBe('Hello <i>world</i>')
    })

    it('keeps <br> tag', () => {
      expect(sanitize('Hello<br>world')).toContain('Hello')
      expect(sanitize('Hello<br>world')).toContain('world')
    })
  })

  describe('dangerous content is stripped', () => {
    it('strips <script> tags and their content', () => {
      const result = sanitize('<script>alert("xss")</script>Hello')
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('alert')
      expect(result).toContain('Hello')
    })

    it('strips <img> tags', () => {
      const result = sanitize('<img src="x" onerror="alert(1)">Hello')
      expect(result).not.toContain('<img')
      expect(result).not.toContain('onerror')
      expect(result).toContain('Hello')
    })

    it('strips onclick and other event attributes from otherwise valid tags', () => {
      const result = sanitize('<b onclick="alert(1)">bold</b>')
      expect(result).not.toContain('onclick')
      expect(result).toContain('bold')
    })

    it('strips href from <a> tags (disallowed tag)', () => {
      const result = sanitize('<a href="http://evil.com">click</a>')
      expect(result).not.toContain('<a')
      // text content should remain
      expect(result).toContain('click')
    })
  })

  describe('disallowed tags: text content preserved, tag stripped', () => {
    it('strips <div> but keeps text', () => {
      const result = sanitize('<div>content</div>')
      expect(result).not.toContain('<div>')
      expect(result).toContain('content')
    })

    it('strips <p> but keeps text', () => {
      const result = sanitize('<p>paragraph</p>')
      expect(result).not.toContain('<p>')
      expect(result).toContain('paragraph')
    })

    it('strips <h1> but keeps text', () => {
      const result = sanitize('<h1>title</h1>')
      expect(result).not.toContain('<h1>')
      expect(result).toContain('title')
    })
  })

  describe('realistic scale label (from mockup)', () => {
    it('preserves bold text in scale labels exactly as in qhogar-encuestas.html', () => {
      const input = 'Tiempo <b>andando a un sitio que yo elija</b> (mi trabajo, casa de familiares)'
      const result = sanitize(input)
      expect(result).toBe(input)
    })
  })
})
