"use client";

import { FadeIn } from "@/components/animations/fade-in";
import { Badge } from "@/components/ui/badge";
import { skillGroups, developerTooling } from "@/data/skills";

export function Skills() {
  return (
    <section id="skills" className="py-24 px-6 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <FadeIn>
          <p className="text-sm text-muted-foreground uppercase tracking-widest mb-4">
            Skills
          </p>
        </FadeIn>

        <FadeIn delay={0.1}>
          <h2 className="text-3xl sm:text-4xl font-bold mb-12">
            Tools I reach for
          </h2>
        </FadeIn>

        <div className="grid sm:grid-cols-2 gap-6">
          {skillGroups.map((group, index) => (
            <FadeIn key={group.label} delay={0.15 + index * 0.05}>
              <div className="p-6 rounded-2xl bg-background border border-border/50 h-full">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.skills.map((skill) => (
                    <Badge key={skill} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* Lower-emphasis developer tooling */}
        <FadeIn delay={0.2}>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Developer tooling
            </p>
            <div className="flex flex-wrap gap-2">
              {developerTooling.map((tool) => (
                <Badge
                  key={tool}
                  variant="outline"
                  className="text-xs text-muted-foreground"
                >
                  {tool}
                </Badge>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
