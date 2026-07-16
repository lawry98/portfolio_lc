import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Project } from "@/data/projects";

interface ProjectMediaProps {
  project: Project;
  sizes: string;
  priority?: boolean;
}

/**
 * Renders a project's screenshot with next/image, or a designed, on-brand
 * fallback (never a bare gray letter) when no asset is available yet.
 */
export function ProjectMedia({ project, sizes, priority }: ProjectMediaProps) {
  if (project.image) {
    return (
      <Image
        src={project.image}
        alt={project.imageAlt ?? project.title}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover object-top"
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex h-full w-full flex-col justify-end gap-3 p-6",
        "bg-[radial-gradient(120%_120%_at_10%_0%,var(--color-muted)_0%,var(--color-background)_70%)]",
      )}
    >
      <span className="text-lg font-semibold leading-snug text-balance text-foreground/80">
        {project.title}
      </span>
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {project.tags.slice(0, 3).join(" · ")}
      </span>
    </div>
  );
}
