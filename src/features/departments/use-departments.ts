import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { DepartmentRow } from "@/types/database.types"

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
