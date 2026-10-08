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
          {/* These words are wider than narrow screens, so only there may
              they break at their soft hyphens */}
          <h2 className="text-3xl sm:text-4xl font-bold mb-16 hyphens-none narrow:hyphens-manual narrow:wrap-break-word">
            Building prod&shy;ucts from inter&shy;face to infra&shy;struc&shy;ture
          </h2>
        </FadeIn>

        {featuredExperience && (
          <ExperienceFlagship experience={featuredExperience} />
        )}

        <ExperienceTimeline items={earlierExperience} />
      </div>
    </section>
  );
}
