import { useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  Download,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  UserX,
  UploadCloud,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { useAuth } from "@/features/auth/auth-context"
import { useDepartments, useMyLedDepartmentIds } from "@/features/departments/use-departments"
import {
  useTags,
  useTerminateVolunteer,
  useVolunteers,
  type VolunteerWithRelations,
} from "./use-volunteers"
import { VolunteerFormDialog } from "./volunteer-form-dialog"
import { VOLUNTEER_STATUS_BADGE, VOLUNTEER_STATUS_LABELS } from "@/lib/constants"
import { exportToCsv, exportToExcel, type ExportColumn } from "@/lib/export"
import type { VolunteerStatus } from "@/types/database.types"

const ALL = "__all__"

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

const EXPORT_COLUMNS: ExportColumn<VolunteerWithRelations>[] = [
  { header: "Full Name", value: (v) => v.full_name },
  { header: "University ID", value: (v) => v.volunteer_private?.university_id },
  { header: "Major", value: (v) => v.volunteer_private?.major },
  { header: "City / Residence", value: (v) => v.volunteer_private?.city },
  { header: "Team", value: (v) => v.departments?.name },
  {
    header: "Other Teams",
    value: (v) =>
      v.volunteer_departments
        .filter((vd) => !vd.is_primary)
        .map((vd) => vd.departments.name)
        .join("; "),
  },
  { header: "WhatsApp", value: (v) => v.volunteer_private?.phone },
  { header: "Email", value: (v) => v.volunteer_private?.email },
  { header: "Status", value: (v) => VOLUNTEER_STATUS_LABELS[v.status] },
  { header: "Skills", value: (v) => v.volunteer_private?.skills },
  { header: "Languages", value: (v) => v.volunteer_private?.languages },
  { header: "Availability", value: (v) => v.volunteer_private?.availability },
  { header: "Join Date", value: (v) => v.join_date },
  { header: "Tags", value: (v) => v.volunteer_tags.map((vt) => vt.tags.name).join("; ") },
]

export function VolunteersPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  // Department and booth leaders only ever get name / photo / team back from
  // the API, so the private columns are hidden for them.
  const isAdmin = profile?.role === "super_admin" || profile?.role === "admin"
  const { data: allVolunteers, isLoading, isError } = useVolunteers()
  const { data: myDepartmentIds = [] } = useMyLedDepartmentIds(profile?.id)
  const { data: allDepartments = [] } = useDepartments()

  // A department leader only manages their own team, so both the roster and the
  // team filter are limited to the departments they lead.
  const volunteers = useMemo(() => {
    if (isAdmin || !allVolunteers) return allVolunteers
    return allVolunteers.filter((volunteer) =>
      volunteer.volunteer_departments.some((vd) => myDepartmentIds.includes(vd.department_id))
    )
  }, [allVolunteers, isAdmin, myDepartmentIds])

  const departments = isAdmin
    ? allDepartments
    : allDepartments.filter((dept) => myDepartmentIds.includes(dept.id))

  const { data: tags = [] } = useTags()
  const terminateVolunteer = useTerminateVolunteer()

  const [search, setSearch] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState(ALL)
  const [statusFilter, setStatusFilter] = useState(ALL)
  const [tagFilter, setTagFilter] = useState(ALL)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<VolunteerWithRelations | null>(null)
  const [terminating, setTerminating] = useState<VolunteerWithRelations | null>(null)

  const filtered = useMemo(() => {
    if (!volunteers) return []
    const term = search.trim().toLowerCase()
    return volunteers.filter((v) => {
      if (term) {
        const haystack = [
          v.full_name,
          v.volunteer_private?.university_id,
          v.volunteer_private?.major,
          v.volunteer_private?.phone,
          v.volunteer_private?.email,
          v.volunteer_private?.city,
          v.volunteer_private?.skills,
          v.departments?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(term)) return false
      }
      if (departmentFilter !== ALL) {
        const inDept = v.volunteer_departments.some((vd) => vd.department_id === departmentFilter)
        if (!inDept) return false
      }
      if (statusFilter !== ALL && v.status !== statusFilter) return false
      if (tagFilter !== ALL && !v.volunteer_tags.some((vt) => vt.tag_id === tagFilter)) return false
      return true
    })
  }, [volunteers, search, departmentFilter, statusFilter, tagFilter])

  function openAdd() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(volunteer: VolunteerWithRelations) {
    setEditing(volunteer)
    setFormOpen(true)
  }

  async function handleTerminate() {
    if (!terminating) return
    try {
      await terminateVolunteer.mutateAsync(terminating.id)
      toast.success(`${terminating.full_name} moved to Terminations`)
      setTerminating(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to terminate")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Volunteers</h1>
          <p className="text-sm text-muted-foreground">
            {volunteers ? `${volunteers.length} total · ${filtered.length} shown` : "Loading…"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <>
              <Button variant="outline" render={<Link to="/import" />}>
                <UploadCloud className="size-4" />
                Import from Sheet
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" />}>
                  <Download className="size-4" />
                  Export
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => exportToExcel(filtered, EXPORT_COLUMNS, "volunteers")}
                  >
                    Excel (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportToCsv(filtered, EXPORT_COLUMNS, "volunteers")}>
                    CSV (.csv)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          <Button onClick={openAdd}>
            <Plus className="size-4" />
            Add Volunteer
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, university ID, major, WhatsApp…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select value={departmentFilter} onValueChange={(v) => setDepartmentFilter(v ?? ALL)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All teams</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? ALL)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {Object.entries(VOLUNTEER_STATUS_LABELS)
                .filter(([value]) => value !== "archived")
                .map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          <Select value={tagFilter} onValueChange={(v) => setTagFilter(v ?? ALL)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All tags</SelectItem>
              {tags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  {tag.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : isError ? (
            <EmptyState
              title="Couldn't load volunteers"
              description="Check your connection and try again."
              icon={Users}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              title={volunteers?.length ? "No volunteers match your filters" : "No volunteers yet"}
              description={
                volunteers?.length
                  ? "Try adjusting the search or filters."
                  : "Add your first volunteer or import them from your Google Sheet."
              }
              icon={Users}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  {isAdmin && <TableHead>University ID</TableHead>}
                  {isAdmin && <TableHead>Major</TableHead>}
                  {isAdmin && <TableHead>Residence</TableHead>}
                  <TableHead>Team</TableHead>
                  {isAdmin && <TableHead>WhatsApp</TableHead>}
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((volunteer) => (
                  <TableRow
                    key={volunteer.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/volunteers/${volunteer.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          {volunteer.photo_url && <AvatarImage src={volunteer.photo_url} />}
                          <AvatarFallback className="bg-accent text-xs text-accent-foreground">
                            {initials(volunteer.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <p className="font-medium text-foreground">{volunteer.full_name}</p>
                      </div>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-sm">
                        {volunteer.volunteer_private?.university_id ?? "—"}
                      </TableCell>
                    )}
                    {isAdmin && (
                      <TableCell className="text-sm">
                        {volunteer.volunteer_private?.major ?? "—"}
                      </TableCell>
                    )}
                    {isAdmin && (
                      <TableCell className="text-sm">
                        {volunteer.volunteer_private?.city ?? "—"}
                      </TableCell>
                    )}
                    <TableCell>
                      <span className="text-sm">{volunteer.departments?.name ?? "—"}</span>
                      {volunteer.volunteer_departments.filter((vd) => !vd.is_primary).length > 0 && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          +{volunteer.volunteer_departments.filter((vd) => !vd.is_primary).length}
                        </span>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-sm" dir="ltr">
                        {volunteer.volunteer_private?.phone ?? "—"}
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge className={VOLUNTEER_STATUS_BADGE[volunteer.status as VolunteerStatus]}>
                        {VOLUNTEER_STATUS_LABELS[volunteer.status as VolunteerStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button variant="ghost" size="icon-sm" aria-label="Actions" />}
                        >
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/volunteers/${volunteer.id}`)}>
                            View profile
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(volunteer)}>
                            <Pencil className="size-4" />
                            Edit
                          </DropdownMenuItem>
                          {isAdmin && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setTerminating(volunteer)}
                              >
                                <UserX className="size-4" />
                                Termination
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <VolunteerFormDialog open={formOpen} onOpenChange={setFormOpen} volunteer={editing} />

      <AlertDialog open={!!terminating} onOpenChange={(open) => !open && setTerminating(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminate {terminating?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will be removed from the volunteers list and their team, and moved to the
              Terminations page. Their history is kept — you can restore them or delete them
              permanently from there.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleTerminate}
            >
              Terminate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
