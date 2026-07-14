"use client";

import { Mail } from "lucide-react";
import { FadeIn } from "@/components/animations/fade-in";

export function Contact() {
  return (
    <section id="contact" className="py-24 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <FadeIn>
          <p className="text-sm text-muted-foreground uppercase tracking-widest mb-4">
            Contact
          </p>
        </FadeIn>

        <FadeIn delay={0.1}>
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            Let&apos;s build something
          </h2>
        </FadeIn>

        <FadeIn delay={0.2}>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10">
            I&apos;m always open to discussing new projects, opportunities, or
            just talking shop about software. Reach out and I&apos;ll get
            back to you.
          </p>
        </FadeIn>

        <FadeIn delay={0.3}>
          <a
            href="mailto:lawry982@gmail.com"
            className="inline-flex items-center gap-2 px-6 py-3 bg-foreground text-background rounded-full font-medium hover:opacity-90 transition-opacity"
          >
            <Mail size={18} />
            lawry982@gmail.com
          </a>
        </FadeIn>
      </div>
    </section>
  );
}
