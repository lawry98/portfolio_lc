import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface FlowDiagramProps {
  steps: string[];
  className?: string;
  ariaLabel: string;
}

/**
 * A clean, static flow diagram. Steps read top-to-bottom on mobile and
 * left-to-right (wrapping) on larger screens. No decorative animation, so it
 * respects reduced-motion by default. Only <li> elements are direct children
 * of the <ol>; the connector arrows are decorative and live inside each step.
 */
export function FlowDiagram({ steps, className, ariaLabel }: FlowDiagramProps) {
  return (
    <ol
      aria-label={ariaLabel}
      className={cn(
        "flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3",
        className,
      )}
    >
      {steps.map((step, index) => (
        <li
          key={step}
          className="flex flex-col items-center gap-2 sm:flex-row sm:gap-3"
        >
          {index > 0 && (
            <ArrowRight
              size={18}
              aria-hidden="true"
              className="shrink-0 rotate-90 text-muted-foreground sm:rotate-0"
            />
          )}
          <span className="flex w-full items-center justify-center rounded-xl border border-border/60 bg-muted/40 px-4 py-3 text-center text-sm font-medium leading-snug sm:w-auto">
            {step}
          </span>
        </li>
      ))}
    </ol>
  );
}
