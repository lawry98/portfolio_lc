import { cn } from "@/lib/utils";
import type { ExperienceMetric } from "@/data/experience";

interface MetricGridProps {
  metrics: ExperienceMetric[];
  className?: string;
}

/** Shared, compact metric cards used on the homepage and case study. */
export function MetricGrid({ metrics, className }: MetricGridProps) {
  return (
    <dl
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4",
        className,
      )}
    >
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="rounded-xl border border-border/50 bg-muted/50 p-4 text-center"
        >
          <dt className="sr-only">{metric.label}</dt>
          <dd>
            <span className="block text-xl sm:text-2xl font-bold tabular-nums text-balance">
              {metric.value}
            </span>
            <span className="mt-1 block text-xs sm:text-sm text-muted-foreground text-balance">
              {metric.label}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
