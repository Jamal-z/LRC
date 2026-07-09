import type {
  EventStatus,
  ParticipationStatus,
  TaskPriority,
  TaskStatus,
  UserRole,
  VolunteerStatus,
} from "@/types/database.types"

export const CENTER_NAME = "LRC (Language Resource Center)"

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin / Director",
  admin: "Admin (Volunteer Management Committee)",
  department_leader: "Department Leader",
  booth_leader: "Booth Leader",
}

export const VOLUNTEER_STATUS_LABELS: Record<VolunteerStatus, string> = {
  new: "New",
  active: "Active",
  inactive: "Inactive",
  on_hold: "On Hold",
  needs_follow_up: "Needs Follow-up",
  archived: "Left / Archived",
}

export const VOLUNTEER_STATUS_BADGE: Record<VolunteerStatus, string> = {
  new: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  inactive: "bg-muted text-muted-foreground",
  on_hold: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  needs_follow_up: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  archived: "bg-neutral-200 text-neutral-600 dark:bg-neutral-500/15 dark:text-neutral-400",
}

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  draft: "Draft",
  planned: "Planned",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  archived: "Archived",
}

export const PARTICIPATION_STATUS_LABELS: Record<ParticipationStatus, string> = {
  invited: "Invited",
  confirmed: "Confirmed",
  attended: "Attended",
  late: "Late",
  excused: "Excused",
  no_show: "No Show",
  cancelled: "Cancelled",
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  waiting_review: "Waiting for Review",
  done: "Done",
  cancelled: "Cancelled",
}

export const TASK_STATUS_ORDER: TaskStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "waiting_review",
  "done",
  "cancelled",
]

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
}

export const TASK_PRIORITY_BADGE: Record<TaskPriority, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  urgent: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
}
