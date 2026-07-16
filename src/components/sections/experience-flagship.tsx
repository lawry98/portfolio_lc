"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BorderBeam } from "@/components/ui/border-beam";
import { MetricGrid } from "@/components/ui/metric-grid";
import { TechGroups } from "@/components/ui/tech-groups";
import { FadeIn } from "@/components/animations/fade-in";
import type { Experience } from "@/data/experience";

interface ExperienceFlagshipProps {
  experience: Experience;
}

export function ExperienceFlagship({ experience }: ExperienceFlagshipProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <FadeIn delay={0.25}>
      <article className="relative overflow-hidden rounded-3xl border border-border/50 bg-card p-6 sm:p-10 mb-20">
        {!prefersReducedMotion && (
          <BorderBeam
            size={220}
            duration={12}
            borderWidth={1.5}
            colorFrom="var(--color-muted-foreground)"
            colorTo="var(--color-foreground)"
            className="opacity-50"
          />
        )}

        <header className="relative flex flex-wrap items-center gap-3 mb-6">
          <Badge className="uppercase tracking-wide text-[11px]">
            Featured Experience
          </Badge>
          <span className="text-sm text-muted-foreground">
            {experience.period}
          </span>
        </header>

        <div className="relative grid lg:grid-cols-[1fr_1.1fr] gap-8 lg:gap-12 items-start">
          <div>
            <h3 className="text-2xl sm:text-3xl font-bold">
              {experience.company}
            </h3>
            <p className="text-muted-foreground mt-1">
              {experience.role} · {experience.location}
            </p>

            <p className="mt-6 text-lg leading-relaxed">{experience.summary}</p>

            {experience.context && (
              <p className="mt-4 text-muted-foreground leading-relaxed">
                {experience.context}
              </p>
            )}

            {experience.contributionSummary && (
              <p className="mt-4 text-muted-foreground leading-relaxed">
                {experience.contributionSummary}
              </p>
            )}
          </div>

          {experience.image && (
            <motion.div
              whileHover={prefersReducedMotion ? undefined : { scale: 1.015 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="relative aspect-video w-full rounded-2xl overflow-hidden border border-border/50 bg-muted"
            >
              <Image
                src={experience.image}
                alt={experience.imageAlt ?? experience.company}
                fill
                sizes="(min-width: 1024px) 55vw, 100vw"
                className="object-cover object-top"
                priority
              />
            </motion.div>
          )}
        </div>

        {experience.metrics && experience.metrics.length > 0 && (
          <MetricGrid metrics={experience.metrics} className="relative mt-10" />
        )}

        {experience.ownershipAreas && experience.ownershipAreas.length > 0 && (
          <div className="relative grid sm:grid-cols-2 gap-4 mt-10">
            {experience.ownershipAreas.map((area) => (
              <div
                key={area.title}
                className="rounded-2xl border border-border/50 bg-background p-5"
              >
                <h4 className="font-semibold mb-2">{area.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {area.description}
                </p>
              </div>
            ))}
          </div>
        )}

        {experience.techGroups && experience.techGroups.length > 0 && (
          <TechGroups
            groups={experience.techGroups}
            className="relative mt-10 pt-8 border-t border-border/50"
          />
        )}

        {(experience.caseStudyHref || experience.website) && (
          <div className="relative mt-10 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
            {experience.caseStudyHref && (
              <Link
                href={experience.caseStudyHref}
                className="group inline-flex items-center justify-center gap-2 px-6 py-3 bg-foreground text-background rounded-full font-medium hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Read case study
                <ArrowRight
                  size={16}
                  aria-hidden="true"
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            )}
            {experience.website && (
              <a
                href={experience.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-foreground/20 rounded-full font-medium hover:bg-foreground/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Visit live website
                <ExternalLink size={16} aria-hidden="true" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            )}
          </div>
        )}
      </article>
    </FadeIn>
  );
}
