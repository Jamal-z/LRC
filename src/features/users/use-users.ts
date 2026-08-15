import { createClient } from "@supabase/supabase-js"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { Database, ProfileRow, UserRole } from "@/types/database.types"

export interface UserWithDepartments extends ProfileRow {
  department_leaders: { id: string; department_id: string; departments: { id: string; name: string } }[]
}

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async (): Promise<UserWithDepartments[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, department_leaders (id, department_id, departments (id, name))")
        .order("created_at")
      if (error) throw error
      return data as unknown as UserWithDepartments[]
    },
  })
}

export interface CreateUserInput {
  email: string
  password: string
  fullName: string
  role: UserRole
  departmentIds: string[]
  notes?: string
}

export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateUserInput) => {
      // A throwaway client (no session persistence) so signing the new user up
      // doesn't touch the admin's current session. The DB trigger caps
      // metadata roles to leader roles; admin/super_admin is applied below by
      // the signed-in super admin, guarded server-side by prevent_role_escalation.
      const tempClient = createClient<Database>(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } }
      )

      const { data, error } = await tempClient.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            full_name: input.fullName,
            role: input.role === "super_admin" || input.role === "admin" ? "department_leader" : input.role,
            notes: input.notes ?? null,
          },
        },
      })
      if (error) {
        if (/rate limit/i.test(error.message)) {
          throw new Error(
            "Supabase's built-in email service only sends ~2 confirmation emails per hour. " +
              'Fix: in the Supabase dashboard go to Authentication → Sign In / Providers → Email and turn OFF "Confirm email" — then account creation is instant and unlimited.'
          )
        }
        throw error
      }
      const newUserId = data.user?.id
      if (!newUserId) throw new Error("User was not created")

      // wait for the profile row created by the DB trigger
      for (let attempt = 0; attempt < 10; attempt++) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", newUserId)
          .maybeSingle()
        if (profile) break
        await new Promise((resolve) => setTimeout(resolve, 400))
      }

      // Signups always land pending (see migration 016). An account an admin
      // typed in here is approved by definition, so activate it right away.
      const elevated = input.role === "super_admin" || input.role === "admin"
      const { error: activateError } = await supabase
        .from("profiles")
        .update({ is_active: true, ...(elevated ? { role: input.role } : {}) })
        .eq("id", newUserId)
      if (activateError) {
        throw new Error(
          elevated
            ? `Account created, but activating it as ${input.role} failed: ${activateError.message}`
            : `Account created, but activating it failed: ${activateError.message}`
        )
      }

      if (input.departmentIds.length) {
        const { error: deptError } = await supabase
          .from("department_leaders")
          .insert(
            input.departmentIds.map((departmentId) => ({
              department_id: departmentId,
              user_id: newUserId,
            }))
          )
        if (deptError) throw deptError
      }

      return newUserId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
      queryClient.invalidateQueries({ queryKey: ["profiles"] })
      queryClient.invalidateQueries({ queryKey: ["department-summaries"] })
    },
  })
}

// Removes the user's profile row. Their login credential technically still
// exists in Supabase Auth (deleting that needs the service key), but with no
// profile every permission check fails and the app signs them out on load —
// effectively removed from the system.
export function useDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("profiles").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
      queryClient.invalidateQueries({ queryKey: ["profiles"] })
      queryClient.invalidateQueries({ queryKey: ["department-summaries"] })
    },
  })
}

/** Approve a signup so the person can actually get into the system. */
export function useApproveUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role?: UserRole }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: true, ...(role ? { role } : {}) })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
      queryClient.invalidateQueries({ queryKey: ["profiles"] })
    },
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      updates,
      departmentIds,
    }: {
      id: string
      updates: Partial<Pick<ProfileRow, "full_name" | "role" | "is_active" | "notes">>
      departmentIds?: string[]
    }) => {
      const { error } = await supabase.from("profiles").update(updates).eq("id", id)
      if (error) throw error

      if (departmentIds) {
        const { error: delError } = await supabase
          .from("department_leaders")
          .delete()
          .eq("user_id", id)
        if (delError) throw delError
        if (departmentIds.length) {
          const { error: insError } = await supabase
            .from("department_leaders")
            .insert(departmentIds.map((departmentId) => ({ department_id: departmentId, user_id: id })))
          if (insError) throw insError
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
      queryClient.invalidateQueries({ queryKey: ["profiles"] })
      queryClient.invalidateQueries({ queryKey: ["department-summaries"] })
    },
  })
}
