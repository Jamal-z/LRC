import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { DepartmentRow } from "@/types/database.types"

/** Departments the signed-in user leads (empty for admins — they lead none). */
export function useMyLedDepartmentIds(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-led-departments", userId],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("department_leaders")
        .select("department_id")
        .eq("user_id", userId!)
      if (error) throw error
      return (data ?? []).map((row) => row.department_id)
    },
    enabled: !!userId,
    staleTime: 5 * 60_000,
  })
}

export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: async (): Promise<DepartmentRow[]> => {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .eq("is_active", true)
        .order("name")
      if (error) throw error
      return data
    },
    staleTime: 5 * 60_000,
  })
}
