'use client'

/**
 * Tiny client component for copy-to-clipboard.
 * Server components can't use onClick/browser APIs — this is the minimal
 * client island required for clipboard access.
 */

import { useState } from 'react'

interface Props {
  text: string
}

export default function CopyButton({ text }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Fallback: select + copy via execCommand (older browsers)
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <button
      onClick={handleCopy}
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: '.04em',
        padding: '4px 10px',
        borderRadius: 7,
        border: '1px solid var(--line)',
        background: copied ? '#E9F4F0' : '#fff',
        color: copied ? 'var(--brand-deep)' : 'var(--muted)',
        cursor: 'pointer',
        transition: '.15s ease',
        whiteSpace: 'nowrap',
      }}
    >
      {copied ? '✓ Copiado' : 'Copiar'}
    </button>
  )
}
