"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowDown, FileText } from "lucide-react";
import { LetterAnimation } from "@/components/animations/letter-animation";
import { site } from "@/data/site";
import { cn } from "@/lib/utils";

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const [grew, setGrew] = useState(false);

  // When the hero has grown past the screen, its content already runs off
  // the bottom, so the scroll arrow is hidden. Rotating the phone or zooming
  // resizes the section, which re-runs the check.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new ResizeObserver(() => {
      const minHeight = parseFloat(getComputedStyle(section).minHeight);
      setGrew(section.getBoundingClientRect().height > minHeight + 0.5);
    });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  // At least one screen tall, and taller when the content needs it (short
  // phones, landscape, high page zoom). svh keeps the arrow above mobile
  // browser toolbars. pt-16 clears the fixed navbar (h-16), and pb-20 clears
  // the arrow (bottom-8 plus its 24px icon) with 24px to spare.
  return (
    <section
      ref={sectionRef}
      className="relative min-h-svh pt-16 pb-20 flex items-center justify-center overflow-hidden"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-linear-to-b from-background via-background to-muted/30" />
      
      {/* Subtle grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(var(--foreground) 1px, transparent 1px),
                           linear-gradient(90deg, var(--foreground) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 text-center px-6">
        {/* Photo. 80px on phones keeps the hero within an iPhone 15's screen
            (390x844), so the scroll arrow stays; 128px from sm up. */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Image
            src={site.photo}
            alt="Portrait of Lawrence Crasto"
            width={128}
            height={128}
            loading="eager"
            className="mx-auto mb-4 size-20 sm:mb-6 sm:size-32 rounded-full object-cover ring-1 ring-border"
          />
        </motion.div>

        {/* Greeting */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-muted-foreground mb-4"
        >
          Hey, I&apos;m
        </motion.p>

        {/* Name. Below sm the heading is at most 5em wide, so the name always
            stacks: "Lawrence" is 4.61em, the whole name 7.9em. It is 48px,
            shrinking under ~276px (phones at high page zoom) so "Lawrence"
            fits inside the px-6 gutters (the 3rem); 4.75 is its 4.61em plus
            ~3% slack. 96px waits for lg: at 768 the 96px name (~762px) is
            wider than the ~720px it gets. */}
        <h1 className="text-[length:min(3rem,(100vw_-_3rem)/4.75)] leading-none mx-auto max-w-[5em] sm:max-w-none sm:text-7xl lg:text-8xl font-bold tracking-tight mb-6">
          <LetterAnimation text="Lawrence Crasto" delay={0.2} />
        </h1>

        {/* Role */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          <p className="text-xl sm:text-2xl md:text-3xl font-medium text-foreground mb-4">
            Full-Stack Software Engineer
          </p>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            M.S. Computer Science, Northeastern University (May&nbsp;2026). I build
            production-ready web applications and AI-powered experiences across
            frontend interfaces, backend services, databases, payments, and cloud
            platforms.
          </p>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <a
            href="#experience"
            className="px-6 py-3 bg-foreground text-background rounded-full font-medium hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            View my work
          </a>
          <a
            href="#contact"
            className="px-6 py-3 border border-foreground/20 rounded-full font-medium hover:bg-foreground/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Get in touch
          </a>
          <a
            href={site.resume}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 narrow:px-3 py-3 border border-foreground/20 rounded-full font-medium hover:bg-foreground/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <FileText size={18} aria-hidden="true" />
            Résumé (PDF)
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className={cn("absolute bottom-8 left-1/2 -translate-x-1/2", grew && "hidden")}
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <ArrowDown className="text-muted-foreground" size={24} />
        </motion.div>
      </motion.div>
    </section>
  );
}