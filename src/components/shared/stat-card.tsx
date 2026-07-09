import type { LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export function StatCard({
  label,
  value,
  icon: Icon,
  isLoading,
  accent,
}: {
  label: string
  value: string | number
  icon: LucideIcon
  isLoading?: boolean
  accent?: string
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          {isLoading ? (
            <Skeleton className="mt-2 h-7 w-14" />
          ) : (
            <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          )}
        </div>
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground",
            accent
          )}
        >
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  )
}
