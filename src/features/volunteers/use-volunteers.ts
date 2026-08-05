import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type {
  DepartmentRow,
  TagRow,
  VolunteerInsert,
  VolunteerPrivateRow,
  VolunteerRow,
  VolunteerUpdate,
} from "@/types/database.types"

export interface VolunteerWithRelations extends VolunteerRow {
  departments: Pick<DepartmentRow, "id" | "name"> | null
  volunteer_departments: { department_id: string; is_primary: boolean; departments: { id: string; name: string } }[]
  volunteer_tags: { tag_id: string; tags: Pick<TagRow, "id" | "name" | "color"> }[]
  // Personal details live in a separate admin-only table: for department and
  // booth leaders RLS returns null here, so the UI simply has nothing to show.
  volunteer_private: VolunteerPrivateRow | null
}

const VOLUNTEER_SELECT = `
  *,
  departments:primary_department_id (id, name),
  volunteer_departments (department_id, is_primary, departments (id, name)),
  volunteer_tags (tag_id, tags (id, name, color)),
  volunteer_private (*)
`

/** Convenience accessors so pages don't repeat the null checks everywhere. */
export const privateField = (
  volunteer: VolunteerWithRelations,
  key: keyof Omit<VolunteerPrivateRow, "volunteer_id" | "created_at" | "updated_at">
) => volunteer.volunteer_private?.[key] ?? null

// active roster — terminated volunteers live in useTerminatedVolunteers
export function useVolunteers() {
  return useQuery({
    queryKey: ["volunteers"],
    queryFn: async (): Promise<VolunteerWithRelations[]> => {
      const { data, error } = await supabase
        .from("volunteers")
        .select(VOLUNTEER_SELECT)
        .neq("status", "archived")
        .order("full_name", { ascending: true })
      if (error) throw error
      return data as unknown as VolunteerWithRelations[]
    },
  })
}

export function useTerminatedVolunteers() {
  return useQuery({
    queryKey: ["volunteers", "terminated"],
    queryFn: async (): Promise<VolunteerWithRelations[]> => {
      const { data, error } = await supabase
        .from("volunteers")
        .select(VOLUNTEER_SELECT)
        .eq("status", "archived")
        .order("archived_at", { ascending: false })
      if (error) throw error
      return data as unknown as VolunteerWithRelations[]
    },
  })
}

export function useVolunteer(id: string | undefined) {
  return useQuery({
    queryKey: ["volunteers", id],
    queryFn: async (): Promise<VolunteerWithRelations> => {
      const { data, error } = await supabase
        .from("volunteers")
        .select(VOLUNTEER_SELECT)
        .eq("id", id!)
        .single()
      if (error) throw error
      return data as unknown as VolunteerWithRelations
    },
    enabled: !!id,
  })
}

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: async (): Promise<TagRow[]> => {
      const { data, error } = await supabase.from("tags").select("*").order("name")
      if (error) throw error
      return data
    },
    staleTime: 5 * 60_000,
  })
}

export type VolunteerPrivateInput = Partial<
  Omit<VolunteerPrivateRow, "volunteer_id" | "created_at" | "updated_at">
>

export interface SaveVolunteerInput {
  volunteer: VolunteerInsert | (VolunteerUpdate & { id: string })
  /** Admin-only personal details; omit entirely when a leader saves. */
  privateFields?: VolunteerPrivateInput
  secondaryDepartmentIds?: string[]
  tagIds?: string[]
}

export function useSaveVolunteer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      volunteer,
      privateFields,
      secondaryDepartmentIds,
      tagIds,
    }: SaveVolunteerInput) => {
      let volunteerId: string

      if ("id" in volunteer && volunteer.id) {
        const { id, ...updates } = volunteer
        const { error } = await supabase.from("volunteers").update(updates).eq("id", id)
        if (error) throw error
        volunteerId = id
      } else {
        const { data, error } = await supabase
          .from("volunteers")
          .insert(volunteer as VolunteerInsert)
          .select("id")
          .single()
        if (error) throw error
        volunteerId = data.id
      }

      if (privateFields) {
        const { error } = await supabase
          .from("volunteer_private")
          .upsert({ volunteer_id: volunteerId, ...privateFields }, { onConflict: "volunteer_id" })
        if (error) throw error
      }

      if (secondaryDepartmentIds) {
        // replace non-primary department links (the primary link is maintained by a DB trigger)
        const { error: delError } = await supabase
          .from("volunteer_departments")
          .delete()
          .eq("volunteer_id", volunteerId)
          .eq("is_primary", false)
        if (delError) throw delError

        const primaryId = volunteer.primary_department_id
        const toInsert = secondaryDepartmentIds
          .filter((deptId) => deptId !== primaryId)
          .map((deptId) => ({ volunteer_id: volunteerId, department_id: deptId }))
        if (toInsert.length) {
          const { error: insError } = await supabase.from("volunteer_departments").insert(toInsert)
          if (insError) throw insError
        }
      }

      if (tagIds) {
        const { error: delError } = await supabase
          .from("volunteer_tags")
          .delete()
          .eq("volunteer_id", volunteerId)
        if (delError) throw delError
        if (tagIds.length) {
          const { error: insError } = await supabase
            .from("volunteer_tags")
            .insert(tagIds.map((tagId) => ({ volunteer_id: volunteerId, tag_id: tagId })))
          if (insError) throw insError
        }
      }

      return volunteerId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["volunteers"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

// "Termination": removes the volunteer from the active roster and all
// department lists; they appear only in the Terminations page until
// permanently deleted (or restored).
export function useTerminateVolunteer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("volunteers")
        .update({ status: "archived", archived_at: new Date().toISOString() })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["volunteers"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

export function useRestoreVolunteer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("volunteers")
        .update({ status: "active", archived_at: null })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["volunteers"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

export function useDeleteVolunteer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("volunteers").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["volunteers"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}
