import { Menu, Search } from "lucide-react"
import { NotificationsBell } from "@/features/notifications/notifications-bell"
import { ThemeToggle } from "./theme-toggle"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/features/auth/auth-context"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Sidebar } from "./sidebar"

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function Topbar() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
      <Sheet>
        <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" />}>
          <Menu className="size-4" />
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          {profile && <Sidebar role={profile.role} />}
        </SheetContent>
      </Sheet>

      <div className="relative flex-1 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search volunteers, events, tasks…" className="pl-9" />
      </div>

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <NotificationsBell />

        <button
          className="ml-1 flex items-center gap-2 rounded-full outline-none transition-transform hover:scale-105"
          aria-label="My profile"
          title="My profile"
          onClick={() => navigate("/profile")}
        >
          <Avatar className="size-8 ring-2 ring-transparent transition-shadow hover:ring-primary/40">
            {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
            <AvatarFallback className="bg-accent text-xs text-accent-foreground">
              {profile ? initials(profile.full_name) : "?"}
            </AvatarFallback>
          </Avatar>
        </button>
      </div>
    </header>
  )
}
