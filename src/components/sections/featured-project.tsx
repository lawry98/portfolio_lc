"use client";

import { motion } from "framer-motion";
import { Github, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FadeIn } from "@/components/animations/fade-in";
import { ProjectMedia } from "@/components/sections/project-media";
import type { Project } from "@/data/projects";

interface FeaturedProjectProps {
  project: Project;
  reverse?: boolean;
}

export function FeaturedProject({ project, reverse = false }: FeaturedProjectProps) {
  const mediaOrderClass = reverse ? "lg:order-2" : "";
  const contentAlignClass = reverse ? "lg:order-1 lg:text-right" : "";
  const contentJustifyClass = reverse ? "lg:justify-end" : "";
  const mediaFadeDirection = reverse ? "right" : "left";
  const contentFadeDirection = reverse ? "left" : "right";

  return (
    <article className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
      {/* Image */}
      <FadeIn direction={mediaFadeDirection}>
        <motion.div
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
          className={`relative aspect-video rounded-2xl overflow-hidden border border-border/50 bg-muted ${mediaOrderClass}`}
        >
          <ProjectMedia
            project={project}
            sizes="(min-width: 1024px) 50vw, 100vw"
          />
        </motion.div>
      </FadeIn>

      {/* Content */}
      <div className={`space-y-4 ${contentAlignClass}`}>
        <FadeIn direction={contentFadeDirection} delay={0.1}>
          <p className="text-sm text-primary font-medium">Featured Project</p>
        </FadeIn>

        <FadeIn direction={contentFadeDirection} delay={0.2}>
          <h3 className="text-2xl sm:text-3xl font-bold">{project.title}</h3>
        </FadeIn>

        <FadeIn direction={contentFadeDirection} delay={0.3}>
          <p className="text-muted-foreground leading-relaxed">
            {project.description}
          </p>
        </FadeIn>

        <FadeIn direction={contentFadeDirection} delay={0.4}>
          <div className={`flex flex-wrap gap-2 ${contentJustifyClass}`}>
            {project.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        </FadeIn>

        <FadeIn direction={contentFadeDirection} delay={0.5}>
          <div className={`flex items-center gap-4 pt-2 ${contentJustifyClass}`}>
            {project.github && (
              <a
                href={project.github}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-full text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Github size={20} aria-hidden="true" />
                <span>View Code</span>
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            )}
            {project.live && (
              <a
                href={project.live}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-full text-foreground font-medium group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <span>Live Demo</span>
                <ArrowRight
                  size={16}
                  aria-hidden="true"
                  className="group-hover:translate-x-1 transition-transform"
                />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            )}
          </div>
        </FadeIn>
      </div>
    </article>
  );
}