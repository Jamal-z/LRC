import { cn } from "@/lib/utils"

/**
 * The centre's official wordmark.
 *
 * The artwork has black lettering under the "LRC", so on the blue sidebar or
 * the dark auth pages it needs the white plate below rather than sitting bare.
 */
export function LrcLogo({ className }: { className?: string }) {
  return (
    <img
      src="/media/lrc-logo.png"
      alt="LRC — Language Resource Center"
      className={cn("w-auto object-contain", className)}
    />
  )
}

/** The wordmark on a white tile, for coloured or dark backgrounds. */
export function LrcLogoPlate({
  className,
  logoClassName,
}: {
  className?: string
  logoClassName?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl bg-white px-2.5 py-1.5 shadow-sm",
        className
      )}
    >
      <LrcLogo className={cn("h-7", logoClassName)} />
    </span>
  )
}
