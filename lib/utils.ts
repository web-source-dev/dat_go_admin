import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Display a proxy without credentials. Handles `scheme://user:pass@host:port`
 * and `host:port:user:pass` → `host:port`.
 */
export function maskProxy(value?: string | null): string {
  if (!value) return ''
  const noScheme = value.trim().replace(/^[a-z0-9]+:\/\//i, '')
  const at = noScheme.lastIndexOf('@')
  if (at >= 0) return noScheme.slice(at + 1)
  const parts = noScheme.split(':')
  return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : noScheme
}

export function truncateText(value: string, max = 48): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}
