import { useEffect, useRef, type RefObject } from "react"
import { Outlet, useLocation, useNavigationType } from "react-router-dom"
import { useAuth } from "@/features/auth/auth-context"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"

/**
 * The page scrolls inside <main>, not the window, so the browser's own scroll
 * restoration never kicks in. Remember each history entry's position and put
 * it back on Back/Forward; a new page starts at the top.
 */
function useMainScrollRestoration(ref: RefObject<HTMLElement | null>) {
  const location = useLocation()
  const navigationType = useNavigationType()

  useEffect(() => {
    const main = ref.current
    if (!main) return
    const storageKey = `lrc-scroll:${location.key}`
    let frame = 0

    const remember = () => {
      try {
        sessionStorage.setItem(storageKey, String(main.scrollTop))
      } catch {
        // storage blocked — restoring is a nicety, not a requirement
      }
    }

    if (navigationType === "POP") {
      let saved = 0
      try {
        saved = Number(sessionStorage.getItem(storageKey) ?? 0)
      } catch {
        saved = 0
      }
      // the page may still be rendering from cache; keep trying for a moment
      // until it is tall enough to scroll that far
      let tries = 0
      const restore = () => {
        main.scrollTop = saved
        if (Math.abs(main.scrollTop - saved) > 2 && tries++ < 60) {
          frame = requestAnimationFrame(restore)
        }
      }
      restore()
    } else if (navigationType === "PUSH") {
      main.scrollTop = 0
      remember()
    } else {
      // REPLACE (a tab or search kept in the URL): stay put, just re-key
      remember()
    }

    main.addEventListener("scroll", remember, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      main.removeEventListener("scroll", remember)
    }
  }, [ref, location.key, navigationType])
}

export function AppLayout() {
  const { profile } = useAuth()
  const mainRef = useRef<HTMLElement>(null)
  useMainScrollRestoration(mainRef)

  if (!profile) return null

  return (
    <div className="flex h-svh bg-gradient-to-br from-sky-50/80 via-background to-blue-50/50 dark:from-background dark:via-background dark:to-background">
      <Sidebar role={profile.role} className="hidden md:flex" />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main ref={mainRef} className="flex-1 overflow-y-auto p-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
