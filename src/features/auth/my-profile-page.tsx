import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Building2, LogOut, Mail, Pencil, ShieldCheck } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "./auth-context"
import { AccountDialog } from "./account-dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { EmptyState } from "@/components/shared/empty-state"
import { ROLE_LABELS } from "@/lib/constants"

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
}

export function MyProfilePage() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [accountOpen, setAccountOpen] = useState(false)

  const { data: myDepartments = [] } = useQuery({
    queryKey: ["my-departments", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("department_leaders")
        .select("id, departments (id, name)")
        .eq("user_id", profile!.id)
      if (error) throw error
      return (data ?? []) as unknown as { id: string; departments: { id: string; name: string } | null }[]
    },
    enabled: !!profile,
  })

  const { data: myBooths = [] } = useQuery({
    queryKey: ["my-booths", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booth_leaders")
        .select("id, event_booths (id, name, events (id, name, date))")
        .eq("user_id", profile!.id)
      if (error) throw error
      return (data ?? []) as unknown as {
        id: string
        event_booths: { id: string; name: string; events: { id: string; name: string; date: string } | null } | null
      }[]
    },
    enabled: !!profile,
  })

  if (!profile) return null

  async function handleSignOut() {
    await signOut()
    navigate("/login", { replace: true })
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-start gap-5">
          <Avatar className="size-24">
            {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
            <AvatarFallback className="bg-accent text-2xl text-accent-foreground">
              {initials(profile.full_name)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-52 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {profile.full_name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-primary" />
                {ROLE_LABELS[profile.role]}
              </span>
              <span className="inline-flex items-center gap-1.5" dir="ltr">
                <Mail className="size-4" />
                {profile.email}
              </span>
            </div>
            {myDepartments.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {myDepartments.map(
                  (dl) =>
                    dl.departments && (
                      <Badge key={dl.id} variant="secondary">
                        <Building2 className="size-3" />
                        {dl.departments.name}
                      </Badge>
                    )
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Button onClick={() => setAccountOpen(true)}>
              <Pencil className="size-4" />
              Edit account
            </Button>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">My booth assignments</CardTitle>
        </CardHeader>
        <CardContent>
          {myBooths.length ? (
            <ul className="divide-y divide-border">
              {myBooths.map(
                (bl) =>
                  bl.event_booths && (
                    <li key={bl.id} className="flex items-center justify-between gap-2 py-2.5">
                      <p className="text-sm font-medium text-foreground">{bl.event_booths.name}</p>
                      {bl.event_booths.events && (
                        <p className="text-xs text-muted-foreground">
                          {bl.event_booths.events.name} ·{" "}
                          {new Date(bl.event_booths.events.date).toLocaleDateString()}
                        </p>
                      )}
                    </li>
                  )
              )}
            </ul>
          ) : (
            <EmptyState
              title="No booth assignments"
              description="Booths you lead in events will show here."
            />
          )}
        </CardContent>
      </Card>

      <AccountDialog open={accountOpen} onOpenChange={setAccountOpen} />
    </div>
  )
}
