"use client";

import { FadeIn } from "@/components/animations/fade-in";
import { ExperienceFlagship } from "@/components/sections/experience-flagship";
import { ExperienceTimeline } from "@/components/sections/experience-timeline";
import { earlierExperience, featuredExperience } from "@/data/experience";

export function Experience() {
  return (
    <section id="experience" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <FadeIn>
          <p className="text-sm text-muted-foreground uppercase tracking-widest mb-4">
            Work Experience
          </p>
        </FadeIn>

        <FadeIn delay={0.1}>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Building products from interface to infrastructure
          </h2>
        </FadeIn>

        <FadeIn delay={0.2}>
          <p className="text-lg text-muted-foreground max-w-2xl mb-16 leading-relaxed">
            I build full-stack web applications and AI-powered features across
            frontend interfaces, backend services, databases, payments, and
            production infrastructure.
          </p>
        </FadeIn>

        {featuredExperience && (
          <ExperienceFlagship experience={featuredExperience} />
        )}

        <ExperienceTimeline items={earlierExperience} />
      </div>
    </section>
  );
}
