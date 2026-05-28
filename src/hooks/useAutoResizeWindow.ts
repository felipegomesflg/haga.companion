import { useLayoutEffect, useRef, type RefObject } from 'react'

/** Resizes the Electron window to fit the measured content (About splash). */
export function useAutoResizeWindow(): RefObject<HTMLDivElement> {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const fit = () => {
      window.haga.setWindowContentSize(Math.ceil(el.scrollWidth), Math.ceil(el.scrollHeight))
    }

    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return ref
}
