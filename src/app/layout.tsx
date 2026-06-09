import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'QHogar · Encuestas de validación',
  description: 'Encuestas de validación de producto QHogar — de parte de Angel Pinto.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      {/* Google Fonts are loaded via @import in globals.css */}
      <body>{children}</body>
    </html>
  )
}
