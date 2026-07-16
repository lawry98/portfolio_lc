import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TechGroup } from "@/data/experience";

interface TechGroupsProps {
  groups: TechGroup[];
  className?: string;
  badgeVariant?: "default" | "secondary" | "outline";
}

/** Shared renderer for grouped technology badges (homepage + case study). */
export function TechGroups({
  groups,
  className,
  badgeVariant = "secondary",
}: TechGroupsProps) {
  return (
    <div
      className={cn(
        "grid gap-6 sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {groups.map((group) => (
        <div key={group.label}>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
            {group.label}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.items.map((tech) => (
              <Badge key={tech} variant={badgeVariant}>
                {tech}
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
