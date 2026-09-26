import { useCallback } from "react"
import { useSearchParams } from "react-router-dom"

/**
 * A piece of page state (open tab, search box, filter) kept in the URL
 * instead of in memory, so the back button lands on the page exactly as it
 * was left. Uses `replace`, so typing a search never adds history entries.
 */
export function useUrlState(key: string, defaultValue: string) {
  const [params, setParams] = useSearchParams()
  const value = params.get(key) ?? defaultValue

  const setValue = useCallback(
    (next: string) => {
      setParams(
        (prev) => {
          const updated = new URLSearchParams(prev)
          if (!next || next === defaultValue) updated.delete(key)
          else updated.set(key, next)
          return updated
        },
        { replace: true }
      )
    },
    [key, defaultValue, setParams]
  )

  return [value, setValue] as const
}
