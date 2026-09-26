import { useCallback } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Goes back to wherever the user actually came from — the applicants list,
 * a department, the calendar — rather than a fixed parent page. `fallback`
 * covers a page opened straight from a link or a fresh tab, where there is
 * no in-app history to return to.
 */
export function useGoBack(fallback: string) {
  const navigate = useNavigate()
  const location = useLocation()
  return useCallback(() => {
    if (location.key !== "default") navigate(-1)
    else navigate(fallback, { replace: true })
  }, [navigate, location.key, fallback])
}

export function BackButton({
  fallback,
  children = "Back",
  className,
}: {
  fallback: string
  children?: React.ReactNode
  className?: string
}) {
  const goBack = useGoBack(fallback)
  return (
    <Button variant="ghost" size="sm" className={className} onClick={goBack}>
      <ArrowLeft className="size-4" />
      {children}
    </Button>
  )
}
