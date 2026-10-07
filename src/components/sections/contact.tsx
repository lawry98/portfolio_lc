"use client";

import { useRef } from "react";
import { useScroll } from "framer-motion";
import { Mail, Github, Linkedin } from "lucide-react";
import { FadeIn } from "@/components/animations/fade-in";
import { Signature } from "@/components/ui/signature";
import { site } from "@/data/site";

export function Contact() {
  const sectionRef = useRef<HTMLElement>(null);
  // On tall viewports the section is taller than the screen and its content
  // is pinned, so the extra scroll signs the name as the page's finale.
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  return (
    <section
      ref={sectionRef}
      id="contact"
      className="relative px-6 py-24 tall:h-[175svh] tall:py-0"
    >
      <div className="max-w-4xl mx-auto text-center tall:sticky tall:top-0 tall:flex tall:h-svh tall:flex-col tall:justify-center tall:pt-16">
        <FadeIn>
          <p className="text-sm text-muted-foreground uppercase tracking-widest mb-4">
            Contact
          </p>
        </FadeIn>

        <FadeIn delay={0.1}>
          {/* These words are wider than narrow screens, so only there may
              they break at their soft hyphens */}
          <h2 className="text-3xl sm:text-4xl font-bold mb-6 hyphens-none narrow:hyphens-manual">
            Let&apos;s build intel&shy;ligent web prod&shy;ucts
          </h2>
        </FadeIn>

        <FadeIn delay={0.2}>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
            I&apos;m exploring full-time software engineering opportunities focused
            on full-stack web applications, AI-powered products, and modern product
            engineering.
          </p>
        </FadeIn>

        <FadeIn delay={0.3}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="mailto:lawry982@gmail.com"
              className="inline-flex items-center gap-2 px-6 narrow:px-3 py-3 bg-foreground text-background rounded-full font-medium hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Mail size={18} aria-hidden="true" className="narrow:hidden" />
              lawry982<wbr />@gmail.com
            </a>
            <a
              href={site.profiles.github}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 narrow:px-3 py-3 border border-foreground/20 rounded-full font-medium hover:bg-foreground/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Github size={18} aria-hidden="true" />
              GitHub
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <a
              href={site.profiles.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 narrow:px-3 py-3 border border-foreground/20 rounded-full font-medium hover:bg-foreground/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Linkedin size={18} aria-hidden="true" />
              LinkedIn
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </FadeIn>

        {/* Decorative sign-off, drawn by scroll; the name is already the page's h1 */}
        <Signature
          progress={scrollYProgress}
          className="mx-auto mt-10 block h-auto w-full max-w-3xl text-foreground sm:mt-20"
        />
      </div>
    </section>
  );
}
