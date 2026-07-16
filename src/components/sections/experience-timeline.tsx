"use client";

import { FadeIn } from "@/components/animations/fade-in";
import { Badge } from "@/components/ui/badge";
import type { Experience } from "@/data/experience";

interface ExperienceTimelineProps {
  items: Experience[];
}

export function ExperienceTimeline({ items }: ExperienceTimelineProps) {
  if (items.length === 0) return null;

  return (
    <div>
      <FadeIn>
        <div className="flex items-center gap-4 mb-10">
          <div className="h-px flex-1 bg-border" />
          <span className="text-sm text-muted-foreground uppercase tracking-widest">
            Earlier Experience
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
      </FadeIn>

      <ol className="relative border-l border-border ml-3 space-y-12">
        {items.map((item, index) => (
          <FadeIn key={item.id} delay={0.1 + index * 0.05}>
            <li className="relative pl-8">
              <span
                aria-hidden="true"
                className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full border-2 border-background bg-muted-foreground"
              />

              <article>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
                  <h3 className="font-semibold text-lg">{item.company}</h3>
                  <span className="text-sm text-muted-foreground">
                    {item.period}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {item.role} · {item.location}
                </p>

                <p className="text-base text-muted-foreground leading-relaxed mb-4">
                  {item.summary}
                </p>

                {item.highlights && item.highlights.length > 0 && (
                  <ul className="space-y-2 mb-4">
                    {item.highlights.map((point) => (
                      <li
                        key={point}
                        className="flex gap-2 text-sm text-muted-foreground leading-relaxed"
                      >
                        <span
                          className="text-foreground/40 mt-1"
                          aria-hidden="true"
                        >
                          •
                        </span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {item.technologies && item.technologies.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {item.technologies.map((tech) => (
                      <Badge key={tech} variant="outline" className="text-xs">
                        {tech}
                      </Badge>
                    ))}
                  </div>
                )}
              </article>
            </li>
          </FadeIn>
        ))}
      </ol>
    </div>
  );
}
