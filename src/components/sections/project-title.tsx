import type { Project } from "@/data/projects";

/**
 * A project's name, linked to its GitHub repo when it has one. Goes inside the
 * card's heading, so the heading stays a heading for screen-reader navigation.
 */
export function ProjectTitle({ project }: { project: Project }) {
  if (!project.github) return project.title;

  return (
    <a
      href={project.github}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-sm decoration-2 underline-offset-4 hover:underline"
    >
      {project.title}
      <span className="sr-only"> on GitHub (opens in a new tab)</span>
    </a>
  );
}
