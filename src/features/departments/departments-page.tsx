import { Link } from "react-router-dom"
import { Building2, Users } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { useDepartmentSummaries } from "./use-department-details"

export function DepartmentsPage() {
  const { data: departments, isLoading, isError } = useDepartmentSummaries()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Departments</h1>
        <p className="text-sm text-muted-foreground">
          The center's teams, their leaders and volunteers.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : isError || !departments?.length ? (
        <EmptyState
          title="No departments found"
          description="Departments are created during system setup."
          icon={Building2}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((dept) => (
            <Link key={dept.id} to={`/departments/${dept.id}`}>
              <Card className="h-full overflow-hidden pt-0 transition-shadow hover:shadow-md">
                {dept.image_url ? (
                  <div className="h-32 w-full overflow-hidden">
                    <img
                      src={dept.image_url}
                      alt={dept.name}
                      className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                    />
                  </div>
                ) : (
                  <div className="flex h-32 w-full items-center justify-center bg-gradient-to-br from-blue-500/15 via-sky-400/10 to-blue-600/15">
                    <Building2 className="size-8 text-primary/50" />
                  </div>
                )}
                <CardContent className="flex h-full flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <span />
                    {!dept.requires_monthly_evaluation && (
                      <Badge variant="outline" className="text-xs">
                        Event-based evaluation
                      </Badge>
                    )}
                  </div>

                  <div>
                    <h2 className="font-semibold text-foreground">{dept.name}</h2>
                    {dept.description && (
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                        {dept.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="size-3.5" />
                      {dept.volunteerCount} volunteers
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {dept.activeCount} active
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {dept.leaders.length
                      ? `Leaders: ${dept.leaders.map((l) => l.profiles.full_name).join(", ")}`
                      : "No leader assigned yet"}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
