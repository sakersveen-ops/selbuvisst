import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Selbuvisst',
  description: 'Det norske stikkspillet',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <body>{children}</body>
    </html>
  )
}
