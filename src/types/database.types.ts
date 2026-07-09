// Hand-written to match supabase/migrations/*.sql.
// Once the real Supabase project is connected, regenerate with:
//   npx supabase gen types typescript --project-id <ref> > src/types/database.types.ts
// and reconcile any drift with this file.

export type UserRole = "super_admin" | "admin" | "department_leader" | "booth_leader"
export type VolunteerStatus =
  | "new"
  | "active"
  | "inactive"
  | "on_hold"
  | "needs_follow_up"
  | "archived"
export type EventStatus = "draft" | "planned" | "in_progress" | "completed" | "cancelled" | "archived"
export type ParticipationStatus =
  | "invited"
  | "confirmed"
  | "attended"
  | "late"
  | "excused"
  | "no_show"
  | "cancelled"
export type TaskStatus = "backlog" | "todo" | "in_progress" | "waiting_review" | "done" | "cancelled"
export type TaskPriority = "low" | "medium" | "high" | "urgent"

export type ProfileRow = {
  id: string
  full_name: string
  email: string
  role: UserRole
  avatar_url: string | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}
export type ProfileInsert = Omit<ProfileRow, "created_at" | "updated_at" | "is_active" | "role"> &
  Partial<Pick<ProfileRow, "created_at" | "updated_at" | "is_active" | "role">>
export type ProfileUpdate = Partial<ProfileInsert>

export type DepartmentRow = {
  id: string
  name: string
  description: string | null
  image_url: string | null
  requires_monthly_evaluation: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}
export type DepartmentInsert = Partial<DepartmentRow> & Pick<DepartmentRow, "name">
export type DepartmentUpdate = Partial<DepartmentRow>

export type DepartmentLeaderRow = {
  id: string
  department_id: string
  user_id: string
  created_at: string
}
export type DepartmentLeaderInsert = Omit<DepartmentLeaderRow, "id" | "created_at"> &
  Partial<Pick<DepartmentLeaderRow, "id" | "created_at">>
export type DepartmentLeaderUpdate = Partial<DepartmentLeaderInsert>

export type VolunteerRow = {
  id: string
  full_name: string
  photo_url: string | null
  phone: string | null
  email: string | null
  city: string | null
  birth_date: string | null
  primary_department_id: string | null
  availability: string | null
  status: VolunteerStatus
  skills: string | null
  languages: string | null
  university_id: string | null
  major: string | null
  join_date: string
  internal_notes: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}
export type VolunteerInsert = Omit<
  VolunteerRow,
  "id" | "status" | "join_date" | "created_at" | "updated_at" | "archived_at"
> &
  Partial<Pick<VolunteerRow, "id" | "status" | "join_date" | "created_at" | "updated_at" | "archived_at">>
export type VolunteerUpdate = Partial<VolunteerInsert>

export type VolunteerDepartmentRow = {
  id: string
  volunteer_id: string
  department_id: string
  is_primary: boolean
  created_at: string
}
export type VolunteerDepartmentInsert = Omit<VolunteerDepartmentRow, "id" | "is_primary" | "created_at"> &
  Partial<Pick<VolunteerDepartmentRow, "id" | "is_primary" | "created_at">>
export type VolunteerDepartmentUpdate = Partial<VolunteerDepartmentInsert>

export type TagRow = {
  id: string
  name: string
  color: string
  created_at: string
}
export type TagInsert = Omit<TagRow, "id" | "color" | "created_at"> & Partial<Pick<TagRow, "id" | "color" | "created_at">>
export type TagUpdate = Partial<TagInsert>

export type VolunteerTagRow = {
  id: string
  volunteer_id: string
  tag_id: string
  created_at: string
}
export type VolunteerTagInsert = Omit<VolunteerTagRow, "id" | "created_at"> & Partial<Pick<VolunteerTagRow, "id" | "created_at">>
export type VolunteerTagUpdate = Partial<VolunteerTagInsert>

export type EventRow = {
  id: string
  name: string
  date: string
  start_time: string | null
  end_time: string | null
  location: string | null
  short_description: string | null
  status: EventStatus
  budget: number | null
  paid_amount: number | null
  sponsor_contribution: number | null
  financial_notes: string | null
  post_event_notes: string | null
  what_went_well: string | null
  what_needs_improvement: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}
export type EventInsert = Partial<EventRow> & Pick<EventRow, "name" | "date">
export type EventUpdate = Partial<EventRow>

export type EventDepartmentRow = {
  id: string
  event_id: string
  department_id: string
}
export type EventDepartmentInsert = Omit<EventDepartmentRow, "id"> & Partial<Pick<EventDepartmentRow, "id">>
export type EventDepartmentUpdate = Partial<EventDepartmentInsert>

export type EventSponsorRow = {
  id: string
  event_id: string
  sponsor_name: string
  contribution_amount: number | null
  notes: string | null
  created_at: string
}
export type EventSponsorInsert = Partial<EventSponsorRow> &
  Pick<EventSponsorRow, "event_id" | "sponsor_name">
export type EventSponsorUpdate = Partial<EventSponsorRow>

export type EventGuestRow = {
  id: string
  event_id: string
  guest_name: string
  role_or_title: string | null
  notes: string | null
  created_at: string
}
export type EventGuestInsert = Partial<EventGuestRow> & Pick<EventGuestRow, "event_id" | "guest_name">
export type EventGuestUpdate = Partial<EventGuestRow>

export type EventAttachmentRow = {
  id: string
  event_id: string
  file_url: string
  file_name: string
  uploaded_by: string | null
  created_at: string
}
export type EventAttachmentInsert = Omit<EventAttachmentRow, "id" | "created_at"> &
  Partial<Pick<EventAttachmentRow, "id" | "created_at">>
export type EventAttachmentUpdate = Partial<EventAttachmentInsert>

export type EventBoothRow = {
  id: string
  event_id: string
  name: string
  description: string | null
  location_in_event: string | null
  notes: string | null
  created_at: string
  updated_at: string
}
export type EventBoothInsert = Partial<EventBoothRow> & Pick<EventBoothRow, "event_id" | "name">
export type EventBoothUpdate = Partial<EventBoothRow>

export type BoothLeaderRow = {
  id: string
  booth_id: string
  user_id: string
  created_at: string
}
export type BoothLeaderInsert = Omit<BoothLeaderRow, "id" | "created_at"> & Partial<Pick<BoothLeaderRow, "id" | "created_at">>
export type BoothLeaderUpdate = Partial<BoothLeaderInsert>

export type EventParticipantRow = {
  id: string
  event_id: string
  booth_id: string | null
  volunteer_id: string
  department_id: string | null
  role_description: string | null
  participation_status: ParticipationStatus
  start_time: string | null
  end_time: string | null
  total_hours: number
  notes: string | null
  created_at: string
  updated_at: string
}
export type EventParticipantInsert = Partial<Omit<EventParticipantRow, "total_hours">> &
  Pick<EventParticipantRow, "event_id" | "volunteer_id">
export type EventParticipantUpdate = Partial<Omit<EventParticipantRow, "total_hours">>

export type EventEvaluationRow = {
  id: string
  event_id: string
  booth_id: string | null
  volunteer_id: string
  evaluated_by: string
  performance_rating: number | null
  commitment_rating: number | null
  teamwork_rating: number | null
  communication_rating: number | null
  notes: string | null
  suggested_tags: string[]
  recommend_for_future_events: boolean | null
  potential_future_booth_leader: boolean | null
  created_at: string
  updated_at: string
}
export type EventEvaluationInsert = Partial<EventEvaluationRow> &
  Pick<EventEvaluationRow, "event_id" | "volunteer_id" | "evaluated_by">
export type EventEvaluationUpdate = Partial<EventEvaluationRow>

export type MonthlyEvaluationRow = {
  id: string
  volunteer_id: string
  department_id: string
  month: number
  year: number
  evaluated_by: string | null
  commitment_rating: number | null
  quality_rating: number | null
  communication_rating: number | null
  teamwork_rating: number | null
  initiative_rating: number | null
  responsiveness_rating: number | null
  overall_rating: number | null
  extra_criteria: Record<string, number | string | boolean | null>
  strengths: string | null
  areas_to_improve: string | null
  leader_notes: string | null
  recommended_status: VolunteerStatus | null
  suggested_tags: string[]
  future_leader_potential: boolean
  needs_follow_up: boolean
  created_at: string
  updated_at: string
}
export type MonthlyEvaluationInsert = Partial<MonthlyEvaluationRow> &
  Pick<MonthlyEvaluationRow, "volunteer_id" | "department_id" | "month" | "year">
export type MonthlyEvaluationUpdate = Partial<MonthlyEvaluationRow>

export type TaskRow = {
  id: string
  title: string
  description: string | null
  department_id: string | null
  assigned_to_user_id: string | null
  assigned_to_volunteer_id: string | null
  created_by: string | null
  due_date: string | null
  priority: TaskPriority
  status: TaskStatus
  board_position: number
  related_event_id: string | null
  related_booth_id: string | null
  related_volunteer_id: string | null
  created_at: string
  updated_at: string
}
export type TaskInsert = Partial<TaskRow> & Pick<TaskRow, "title">
export type TaskUpdate = Partial<TaskRow>

export type TaskCommentRow = {
  id: string
  task_id: string
  user_id: string
  comment: string
  created_at: string
}
export type TaskCommentInsert = Omit<TaskCommentRow, "id" | "created_at"> & Partial<Pick<TaskCommentRow, "id" | "created_at">>
export type TaskCommentUpdate = Partial<TaskCommentInsert>

export type TaskAttachmentRow = {
  id: string
  task_id: string
  file_url: string
  file_name: string
  uploaded_by: string | null
  created_at: string
}
export type TaskAttachmentInsert = Omit<TaskAttachmentRow, "id" | "created_at"> &
  Partial<Pick<TaskAttachmentRow, "id" | "created_at">>
export type TaskAttachmentUpdate = Partial<TaskAttachmentInsert>

export type NotificationRow = {
  id: string
  user_id: string
  title: string
  message: string | null
  type: string
  is_read: boolean
  related_entity_type: string | null
  related_entity_id: string | null
  created_at: string
}
export type NotificationInsert = Omit<NotificationRow, "id" | "is_read" | "created_at"> &
  Partial<Pick<NotificationRow, "id" | "is_read" | "created_at">>
export type NotificationUpdate = Partial<NotificationInsert>

export type ImportLogRow = {
  id: string
  imported_by: string | null
  file_name: string
  total_rows: number
  successful_rows: number
  failed_rows: number
  duplicate_rows: number
  import_summary: Record<string, unknown>
  created_at: string
}
export type ImportLogInsert = Omit<ImportLogRow, "id" | "created_at"> & Partial<Pick<ImportLogRow, "id" | "created_at">>
export type ImportLogUpdate = Partial<ImportLogInsert>

export type ActivityLogRow = {
  id: string
  user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  created_at: string
}
export type ActivityLogInsert = Omit<ActivityLogRow, "id" | "created_at"> & Partial<Pick<ActivityLogRow, "id" | "created_at">>
export type ActivityLogUpdate = Partial<ActivityLogInsert>

export type LeaderEvaluationRow = {
  id: string
  event_id: string
  leader_user_id: string
  evaluated_by: string
  leadership_rating: number | null
  organization_rating: number | null
  communication_rating: number | null
  overall_rating: number | null
  notes: string | null
  created_at: string
  updated_at: string
}
export type LeaderEvaluationInsert = Partial<LeaderEvaluationRow> &
  Pick<LeaderEvaluationRow, "event_id" | "leader_user_id" | "evaluated_by">
export type LeaderEvaluationUpdate = Partial<LeaderEvaluationRow>

export type FormSubmissionRow = {
  id: string
  full_name: string
  university_id: string | null
  major: string | null
  phone: string | null
  email: string | null
  city: string | null
  department_id: string | null
  languages: string | null
  skills: string | null
  availability: string | null
  notes: string | null
  status: "pending" | "approved" | "rejected"
  reviewed_by: string | null
  created_at: string
}
export type FormSubmissionInsert = Partial<FormSubmissionRow> & Pick<FormSubmissionRow, "full_name">
export type FormSubmissionUpdate = Partial<FormSubmissionRow>

type TableDef<Row, Insert, Update> = { Row: Row; Insert: Insert; Update: Update; Relationships: [] }

export type Database = {
  public: {
    Tables: {
      profiles: TableDef<ProfileRow, ProfileInsert, ProfileUpdate>
      departments: TableDef<DepartmentRow, DepartmentInsert, DepartmentUpdate>
      department_leaders: TableDef<DepartmentLeaderRow, DepartmentLeaderInsert, DepartmentLeaderUpdate>
      volunteers: TableDef<VolunteerRow, VolunteerInsert, VolunteerUpdate>
      volunteer_departments: TableDef<VolunteerDepartmentRow, VolunteerDepartmentInsert, VolunteerDepartmentUpdate>
      tags: TableDef<TagRow, TagInsert, TagUpdate>
      volunteer_tags: TableDef<VolunteerTagRow, VolunteerTagInsert, VolunteerTagUpdate>
      events: TableDef<EventRow, EventInsert, EventUpdate>
      event_departments: TableDef<EventDepartmentRow, EventDepartmentInsert, EventDepartmentUpdate>
      event_sponsors: TableDef<EventSponsorRow, EventSponsorInsert, EventSponsorUpdate>
      event_guests: TableDef<EventGuestRow, EventGuestInsert, EventGuestUpdate>
      event_attachments: TableDef<EventAttachmentRow, EventAttachmentInsert, EventAttachmentUpdate>
      event_booths: TableDef<EventBoothRow, EventBoothInsert, EventBoothUpdate>
      booth_leaders: TableDef<BoothLeaderRow, BoothLeaderInsert, BoothLeaderUpdate>
      event_participants: TableDef<EventParticipantRow, EventParticipantInsert, EventParticipantUpdate>
      event_evaluations: TableDef<EventEvaluationRow, EventEvaluationInsert, EventEvaluationUpdate>
      monthly_evaluations: TableDef<MonthlyEvaluationRow, MonthlyEvaluationInsert, MonthlyEvaluationUpdate>
      tasks: TableDef<TaskRow, TaskInsert, TaskUpdate>
      task_comments: TableDef<TaskCommentRow, TaskCommentInsert, TaskCommentUpdate>
      task_attachments: TableDef<TaskAttachmentRow, TaskAttachmentInsert, TaskAttachmentUpdate>
      notifications: TableDef<NotificationRow, NotificationInsert, NotificationUpdate>
      import_logs: TableDef<ImportLogRow, ImportLogInsert, ImportLogUpdate>
      activity_logs: TableDef<ActivityLogRow, ActivityLogInsert, ActivityLogUpdate>
      leader_evaluations: TableDef<LeaderEvaluationRow, LeaderEvaluationInsert, LeaderEvaluationUpdate>
      form_submissions: TableDef<FormSubmissionRow, FormSubmissionInsert, FormSubmissionUpdate>
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      user_role: UserRole
      volunteer_status: VolunteerStatus
      event_status: EventStatus
      participation_status: ParticipationStatus
      task_status: TaskStatus
      task_priority: TaskPriority
    }
  }
}
