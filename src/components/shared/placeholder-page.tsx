import type { LucideIcon } from "lucide-react"
import { Construction } from "lucide-react"

export function PlaceholderPage({
  title,
  description,
  icon: Icon = Construction,
}: {
  title: string
  description: string
  icon?: LucideIcon
}) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>

      <div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 py-24 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Icon className="size-5" />
        </div>
        <p className="text-sm font-medium text-foreground">This module is coming up next</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          The layout, navigation and permissions for this page are already wired up — the full feature is built in a later phase.
        </p>
      </div>
    </div>
  )
}
