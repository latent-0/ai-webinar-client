/**
 * Navigation helpers (LLP-113)
 * Reads the active `?tab=` sub-view from the URL and re-renders on change.
 */

import { useRouterState } from '@tanstack/react-router'

/** Return the current `?tab=` value (or a fallback), re-rendering on navigation. */
export function useActiveTab(fallback: string): string {
  // Subscribe to location changes so the component re-renders on ?tab= change.
  const href = useRouterState({ select: (s) => s.location.href })
  const q = href.includes('?') ? href.slice(href.indexOf('?')) : ''
  const tab = new URLSearchParams(q).get('tab')
  return tab || fallback
}

/** Read an arbitrary query param, re-rendering on navigation. */
export function useQueryParam(key: string): string | null {
  const href = useRouterState({ select: (s) => s.location.href })
  const q = href.includes('?') ? href.slice(href.indexOf('?')) : ''
  return new URLSearchParams(q).get(key)
}
