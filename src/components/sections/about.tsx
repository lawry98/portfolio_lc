"use client";

import { motion } from "framer-motion";
import { FadeIn } from "@/components/animations/fade-in";
import { MapPin, GraduationCap, Briefcase } from "lucide-react";

const highlights = [
  {
    icon: GraduationCap,
    label: "Education",
    value: "M.S. Computer Science",
    detail: "Northeastern University · 4.0 GPA",
  },
  {
    icon: MapPin,
    label: "Location",
    value: "Greater Boston, MA",
    detail: "Open to relocation",
  },
  {
    icon: Briefcase,
    label: "Focus",
    value: "Full-stack web applications & AI",
    detail: "Product engineering · intelligent workflows",
  },
];

export function About() {
  return (
    <section id="about" className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <FadeIn>
          <p className="text-sm text-muted-foreground uppercase tracking-widest mb-4">
            About
          </p>
        </FadeIn>

        <FadeIn delay={0.1}>
          <h2 className="text-3xl sm:text-4xl font-bold mb-8">
            I build products end to end.
          </h2>
        </FadeIn>

        <div className="space-y-6 text-muted-foreground">
          <FadeIn delay={0.2}>
            <p className="text-lg leading-relaxed">
              I&apos;m a full-stack software engineer focused on building reliable,
              intuitive web applications and AI-powered product experiences. I work
              across responsive interfaces, backend APIs, databases, authentication,
              payments, cloud services, and production delivery.
            </p>
          </FadeIn>

          <FadeIn delay={0.3}>
            <p className="text-lg leading-relaxed">
              Most recently, I helped build Quill &amp; Pigeon&apos;s multi-tenant
              commerce platform and developed AI-assisted product experiences using
              the OpenAI API, Claude API, MCP, Langfuse, and workflow automation
              tools.
            </p>
          </FadeIn>
        </div>

        {/* Highlight Cards */}
        <div className="grid sm:grid-cols-3 gap-4 mt-12">
          {highlights.map((item, index) => (
            <FadeIn key={item.label} delay={0.4 + index * 0.1}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="p-6 rounded-2xl bg-muted/50 border border-border/50 h-full"
              >
                <item.icon className="text-foreground mb-3" size={24} />
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  {item.label}
                </p>
                <p className="font-semibold">{item.value}</p>
                <p className="text-sm text-muted-foreground">{item.detail}</p>
              </motion.div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
