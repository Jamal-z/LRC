import { useState } from "react"
import { Plus, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { EmptyState } from "@/components/shared/empty-state"
import { useAuth } from "@/features/auth/auth-context"
import { useDepartments } from "@/features/departments/use-departments"
import { useCreateUser, useDeleteUser, useUpdateUser, useUsers, type UserWithDepartments } from "./use-users"
import { ROLE_LABELS } from "@/lib/constants"
import type { UserRole } from "@/types/database.types"

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
}

const ROLE_BADGE: Record<UserRole, string> = {
  super_admin: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  admin: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  department_leader: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  booth_leader: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
}

export function UsersPage() {
  const { profile } = useAuth()
  const { data: users, isLoading } = useUsers()
  const { data: departments = [] } = useDepartments()
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()

  const isSuperAdmin = profile?.role === "super_admin"

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<UserWithDepartments | null>(null)
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<UserRole>("department_leader")
  const [departmentIds, setDepartmentIds] = useState<string[]>([])
  const [notes, setNotes] = useState("")
  const [isActive, setIsActive] = useState(true)

  function openAdd() {
    setEditing(null)
    setFullName("")
    setEmail("")
    setPassword("")
    setRole("department_leader")
    setDepartmentIds([])
    setNotes("")
    setIsActive(true)
    setDialogOpen(true)
  }

  function openEdit(user: UserWithDepartments) {
    setEditing(user)
    setFullName(user.full_name)
    setEmail(user.email)
    setPassword("")
    setRole(user.role)
    setDepartmentIds(user.department_leaders.map((dl) => dl.department_id))
    setNotes(user.notes ?? "")
    setIsActive(user.is_active)
    setDialogOpen(true)
  }

  async function handleSave() {
    if (editing) {
      try {
        await updateUser.mutateAsync({
          id: editing.id,
          updates: {
            full_name: fullName,
            ...(isSuperAdmin ? { role } : {}),
            is_active: isActive,
            notes: notes || null,
          },
          departmentIds,
        })
        toast.success("User updated")
        setDialogOpen(false)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update user")
      }
      return
    }

    if (fullName.trim().length < 2 || !email.includes("@") || password.length < 8) {
      toast.error("Fill in name, a valid email, and a password of at least 8 characters.")
      return
    }
    try {
      await createUser.mutateAsync({
        email: email.trim().toLowerCase(),
        password,
        fullName: fullName.trim(),
        role,
        departmentIds,
        notes: notes || undefined,
      })
      toast.success(`Account created for ${fullName}. Share the temporary password with them securely.`)
      setDialogOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create user")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Users & Roles</h1>
          <p className="text-sm text-muted-foreground">
            Internal accounts for directors, admins, department leaders and booth leaders.
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="size-4" />
          Create User
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-3 p-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !users?.length ? (
            <EmptyState title="No users yet" icon={ShieldCheck} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Departments</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="bg-accent text-xs text-accent-foreground">
                            {initials(user.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">{user.full_name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={ROLE_BADGE[user.role]}>{ROLE_LABELS[user.role]}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-56 flex-wrap gap-1">
                        {user.department_leaders.length ? (
                          user.department_leaders.map((dl) => (
                            <Badge key={dl.id} variant="outline" className="text-xs">
                              {dl.departments.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? "secondary" : "outline"}>
                        {user.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => openEdit(user)}>
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.full_name}` : "Create internal user"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update role, departments and status."
                : "Creates a login account. Share the temporary password with the person securely."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <Field>
              <FieldLabel htmlFor="u-name">Full name *</FieldLabel>
              <Input id="u-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </Field>

            {!editing && (
              <>
                <Field>
                  <FieldLabel htmlFor="u-email">Email *</FieldLabel>
                  <Input
                    id="u-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="u-password">Temporary password *</FieldLabel>
                  <Input
                    id="u-password"
                    type="text"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <FieldDescription>
                    They sign in with this and can change it later.
                  </FieldDescription>
                </Field>
              </>
            )}

            <Field>
              <FieldLabel>Role</FieldLabel>
              <Select
                value={role}
                onValueChange={(v) => setRole((v ?? "department_leader") as UserRole)}
                disabled={!!editing && !isSuperAdmin}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as UserRole[])
                    .filter((r) => isSuperAdmin || (r !== "super_admin" && r !== "admin"))
                    .map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {!isSuperAdmin && (
                <FieldDescription>Only the Super Admin can grant admin roles.</FieldDescription>
              )}
            </Field>

            <Field>
              <FieldLabel>Lead these departments</FieldLabel>
              <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-lg border border-border p-3">
                {departments.map((dept) => (
                  <label key={dept.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={departmentIds.includes(dept.id)}
                      onCheckedChange={(checked) =>
                        setDepartmentIds((prev) =>
                          checked ? [...prev, dept.id] : prev.filter((id) => id !== dept.id)
                        )
                      }
                    />
                    {dept.name}
                  </label>
                ))}
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="u-notes">Notes</FieldLabel>
              <Textarea id="u-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>

            {editing && (
              <label className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                <span className="font-medium text-foreground">Active account</span>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </label>
            )}
          </div>

          <div className="flex justify-between gap-2">
            {editing && isSuperAdmin && editing.id !== profile?.id ? (
              <Button
                variant="destructive"
                disabled={deleteUser.isPending}
                onClick={async () => {
                  try {
                    await deleteUser.mutateAsync(editing.id)
                    toast.success(`${editing.full_name} deleted`)
                    setDialogOpen(false)
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Failed to delete user")
                  }
                }}
              >
                {deleteUser.isPending ? "Deleting…" : "Delete user"}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={createUser.isPending || updateUser.isPending}>
                {createUser.isPending || updateUser.isPending
                  ? "Saving…"
                  : editing
                    ? "Save changes"
                    : "Create user"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
