import { Link } from "react-router-dom"
import { useDepartments } from "@/features/departments/use-departments"

// Auto-scrolling strip of department photos on the dashboard.
// Only renders once at least one department has an image (added in Settings).
export function DepartmentCarousel() {
  const { data: departments = [] } = useDepartments()
  const withImages = departments.filter((dept) => dept.image_url)

  if (withImages.length === 0) return null

  // duplicated list makes the CSS loop seamless
  const items = [...withImages, ...withImages]

  return (
    <div className="group relative overflow-hidden rounded-2xl">
      <div
        className="flex w-max gap-3 group-hover:[animation-play-state:paused]"
        style={{ animation: `marquee ${withImages.length * 8}s linear infinite` }}
      >
        {items.map((dept, index) => (
          <Link
            key={`${dept.id}-${index}`}
            to={`/departments/${dept.id}`}
            className="relative h-36 w-64 shrink-0 overflow-hidden rounded-2xl shadow-sm"
          >
            <img
              src={dept.image_url!}
              alt={dept.name}
              className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
            />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pt-8 pb-2 text-sm font-semibold text-white">
              {dept.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
