"use client";

import { useEffect, useRef, useState } from "react";
import { useScroll } from "framer-motion";
import { Mail, Github, Linkedin } from "lucide-react";
import { FadeIn } from "@/components/animations/fade-in";
import { Signature } from "@/components/ui/signature";
import { site } from "@/data/site";
import { cn } from "@/lib/utils";

export function Contact() {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // Starts pinned to match the server render; the check below may undo it.
  const [pinned, setPinned] = useState(true);
  // On tall viewports the section is taller than the screen and its content
  // is pinned, so the extra scroll signs the name as the page's finale.
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  // Pin only while the content, with the signature at full size, fits on one
  // screen below the navbar. The content is at least a screen tall
  // (min-h-svh), so taller means it doesn't fit: short phones, and phones at
  // high page zoom where the buttons wrap. Those scroll normally and show the
  // signature finished. Below the tall breakpoint there's no min-height, so
  // the check fails and nothing pins.
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const observer = new ResizeObserver(() => {
      const minHeight = parseFloat(getComputedStyle(content).minHeight);
      setPinned(content.getBoundingClientRect().height <= minHeight + 0.5);
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  // Unpinned on a tall screen, pt-8 plus the content's pt-16 makes the same
  // 96px as the other sections' py-24.
  return (
    <section
      ref={sectionRef}
      id="contact"
      className={cn(
        "relative px-6 py-24",
        pinned ? "tall:h-[175svh] tall:py-0" : "tall:pt-8"
      )}
    >
      <div
        ref={contentRef}
        className={cn(
          "max-w-4xl mx-auto text-center tall:flex tall:min-h-svh tall:flex-col tall:justify-center tall:pt-16",
          pinned && "tall:sticky tall:top-0"
        )}
      >
        <FadeIn>
          <p className="text-sm text-muted-foreground uppercase tracking-widest mb-4">
            Contact
          </p>
        </FadeIn>

        <FadeIn delay={0.1}>
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            Let&apos;s build intelligent web products
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
              className="inline-flex items-center gap-2 px-6 narrow:px-4 py-3 bg-foreground text-background rounded-full font-medium hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Mail size={18} aria-hidden="true" className="narrow:hidden" />
              lawry982<wbr />@gmail.com
            </a>
            <a
              href={site.profiles.github}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 narrow:px-4 py-3 border border-foreground/20 rounded-full font-medium hover:bg-foreground/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Github size={18} aria-hidden="true" />
              GitHub
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <a
              href={site.profiles.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 narrow:px-4 py-3 border border-foreground/20 rounded-full font-medium hover:bg-foreground/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
          signed={!pinned}
          className="mx-auto mt-10 block h-auto w-full max-w-3xl text-foreground sm:mt-20"
        />
      </div>
    </section>
  );
}
