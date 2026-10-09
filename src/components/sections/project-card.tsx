"use client";

import { motion } from "framer-motion";
import { ExternalLink, Github } from "lucide-react";
import { useReveal } from "@/components/animations/use-reveal";
import { Badge } from "@/components/ui/badge";
import { ProjectMedia } from "@/components/sections/project-media";
import { ProjectTitle } from "@/components/sections/project-title";
import type { Project } from "@/data/projects";

interface ProjectCardProps {
  project: Project;
  index: number;
}

export function ProjectCard({ project, index }: ProjectCardProps) {
  const { ref, controls } = useReveal("-50px");

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={controls}
      variants={{
        hidden: { opacity: 0, y: 30 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.5, delay: index * 0.1 },
        },
      }}
    >
      <motion.article
        whileHover={{ y: -8 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="group relative flex h-full flex-col rounded-2xl border border-border/50 bg-card overflow-hidden narrow:hyphens-auto narrow:wrap-break-word"
      >
        {/* Image Container */}
        <div className="relative h-48 shrink-0 overflow-hidden bg-muted">
          <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.02]">
            <ProjectMedia
              project={project}
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            />
          </div>

          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/5 transition-colors duration-300" />
        </div>

        {/* Content, a column so the links row sits at the bottom of every card */}
        <div className="flex flex-1 flex-col p-6 narrow:p-3">
          <h3 className="text-xl narrow:text-base font-semibold group-hover:text-primary transition-colors">
            <ProjectTitle project={project} />
          </h3>
          {project.period && (
            <p className="mt-1 text-sm text-muted-foreground">
              {project.period}
            </p>
          )}

          <p className="mt-2 text-muted-foreground text-sm mb-4 line-clamp-2">
            {project.description}
          </p>

          {project.highlights && project.highlights.length > 0 && (
            <ul className="space-y-2 mb-4">
              {project.highlights.map((point) => (
                <li
                  key={point}
                  className="flex gap-2 text-sm text-muted-foreground leading-relaxed"
                >
                  <span className="text-foreground/40 mt-1" aria-hidden="true">
                    •
                  </span>
                  <span className="narrow:min-w-0 text-pretty">{point}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-4">
            {project.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>

          {/* Links */}
          <div className="mt-auto flex items-center gap-3 pt-2 border-t border-border/50">
            {project.github && (
              <a
                href={project.github}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-full text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Github size={16} aria-hidden="true" />
                <span>Code</span>
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            )}
            {project.live && (
              <a
                href={project.live}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-full text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <ExternalLink size={16} aria-hidden="true" />
                <span>Live Demo</span>
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            )}
          </div>
        </div>
      </motion.article>
    </motion.div>
  );
}