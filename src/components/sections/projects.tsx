"use client";

import { motion, AnimatePresence } from "framer-motion";
import { FadeIn } from "@/components/animations/fade-in";
import { ProjectCard } from "@/components/sections/project-card";
import { FeaturedProject } from "@/components/sections/featured-project";
import { projects, featuredProjects } from "@/data/projects";

export function Projects() {
  const gridProjects = projects.filter((p) => !p.featured);

  return (
    <section id="projects" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <FadeIn>
          <p className="text-sm text-muted-foreground uppercase tracking-widest mb-4">
            Projects
          </p>
        </FadeIn>

        <FadeIn delay={0.1}>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Things I&apos;ve built
          </h2>
        </FadeIn>

        <FadeIn delay={0.2}>
          <p className="text-muted-foreground max-w-2xl mb-16">
            A closer look at my latest build — an AI agent powered by
            LangGraph and Claude, wrapped in a Three.js-driven 3D interface
            built to show off front-end craft as much as backend smarts.
          </p>
        </FadeIn>

        {/* Featured Projects */}
        <div className="space-y-24">
          {featuredProjects.map((project, index) => (
            <FeaturedProject
              key={project.id}
              project={project}
              reverse={index % 2 === 1}
            />
          ))}
        </div>

        {/* More Projects */}
        {gridProjects.length > 0 && (
          <>
            <FadeIn>
              <div className="flex items-center gap-4 my-12">
                <div className="h-px flex-1 bg-border" />
                <span className="text-sm text-muted-foreground">More Projects</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            </FadeIn>

            <motion.div
              layout
              className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              <AnimatePresence mode="popLayout">
                {gridProjects.map((project, index) => (
                  <ProjectCard key={project.id} project={project} index={index} />
                ))}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </div>
    </section>
  );
}
