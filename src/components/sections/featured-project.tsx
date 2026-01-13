"use client";

import { motion } from "framer-motion";
import { Github, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FadeIn } from "@/components/animations/fade-in";
import type { Project } from "@/data/projects";

interface FeaturedProjectProps {
  project: Project;
  reverse?: boolean;
}

export function FeaturedProject({ project, reverse = false }: FeaturedProjectProps) {
  return (
    <div
      className={`grid lg:grid-cols-2 gap-8 lg:gap-12 items-center ${
        reverse ? "lg:direction-rtl" : ""
      }`}
    >
      {/* Image */}
      <FadeIn direction={reverse ? "right" : "left"}>
        <motion.div
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
          className={`relative aspect-video rounded-2xl overflow-hidden bg-muted ${
            reverse ? "lg:order-2" : ""
          }`}
        >
          {project.image ? (
            <img
              src={project.image}
              alt={project.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
              <span className="text-6xl font-bold text-primary/20">
                {project.title.charAt(0)}
              </span>
            </div>
          )}
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent" />
        </motion.div>
      </FadeIn>

      {/* Content */}
      <div className={`space-y-4 ${reverse ? "lg:order-1 lg:text-right" : ""}`}>
        <FadeIn direction={reverse ? "left" : "right"} delay={0.1}>
          <p className="text-sm text-primary font-medium">Featured Project</p>
        </FadeIn>

        <FadeIn direction={reverse ? "left" : "right"} delay={0.2}>
          <h3 className="text-2xl sm:text-3xl font-bold">{project.title}</h3>
        </FadeIn>

        <FadeIn direction={reverse ? "left" : "right"} delay={0.3}>
          <p className="text-muted-foreground leading-relaxed">
            {project.description}
          </p>
        </FadeIn>

        <FadeIn direction={reverse ? "left" : "right"} delay={0.4}>
          <div className={`flex flex-wrap gap-2 ${reverse ? "lg:justify-end" : ""}`}>
            {project.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        </FadeIn>

        <FadeIn direction={reverse ? "left" : "right"} delay={0.5}>
          <div className={`flex items-center gap-4 pt-2 ${reverse ? "lg:justify-end" : ""}`}>
            {project.github && (
              <a
                href={project.github}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Github size={20} />
                <span>View Code</span>
              </a>
            )}
            {project.live && (
              <a
                href={project.live}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-foreground font-medium group"
              >
                <span>Live Demo</span>
                <ArrowRight
                  size={16}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </a>
            )}
          </div>
        </FadeIn>
      </div>
    </div>
  );
}