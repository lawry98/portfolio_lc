"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FadeIn } from "@/components/animations/fade-in";
import { ProjectCard } from "@/components/sections/project-card";
import { ProjectFilters } from "@/components/sections/project-filters";
import { FeaturedProject } from "@/components/sections/featured-project";
import { projects, featuredProjects } from "@/data/projects";

export function Projects() {
  const [activeCategory, setActiveCategory] = useState("All");

  const categories = ["All", "Machine Learning", "Data Visualization", "Computer Vision", "Python"];

  const filteredProjects = useMemo(() => {
    if (activeCategory === "All") return projects;
    return projects.filter((project) =>
      project.tags.some((tag) =>
        tag.toLowerCase().includes(activeCategory.toLowerCase()) ||
        activeCategory.toLowerCase().includes(tag.toLowerCase())
      )
    );
  }, [activeCategory]);

  // Non-featured projects for the grid
  const gridProjects = useMemo(() => {
    return filteredProjects.filter((p) => !p.featured);
  }, [filteredProjects]);

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
            A collection of projects spanning machine learning, computer vision,
            and data visualization. Each represents a unique challenge and learning experience.
          </p>
        </FadeIn>

        {/* Featured Projects */}
        {activeCategory === "All" && (
          <div className="space-y-24 mb-24">
            {featuredProjects.map((project, index) => (
              <FeaturedProject
                key={project.id}
                project={project}
                reverse={index % 2 === 1}
              />
            ))}
          </div>
        )}

        {/* Divider */}
        {activeCategory === "All" && gridProjects.length > 0 && (
          <FadeIn>
            <div className="flex items-center gap-4 mb-12">
              <div className="h-px flex-1 bg-border" />
              <span className="text-sm text-muted-foreground">More Projects</span>
              <div className="h-px flex-1 bg-border" />
            </div>
          </FadeIn>
        )}

        {/* Filters */}
        <FadeIn delay={0.3}>
          <ProjectFilters
            categories={categories}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />
        </FadeIn>

        {/* Projects Grid */}
        <motion.div
          layout
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          <AnimatePresence mode="popLayout">
            {(activeCategory === "All" ? gridProjects : filteredProjects).map(
              (project, index) => (
                <ProjectCard key={project.id} project={project} index={index} />
              )
            )}
          </AnimatePresence>
        </motion.div>

        {filteredProjects.length === 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-muted-foreground py-12"
          >
            No projects found in this category.
          </motion.p>
        )}
      </div>
    </section>
  );
}