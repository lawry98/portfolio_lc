import { Navbar } from "@/components/sections/navbar";
import { Hero } from "@/components/sections/hero";
import { About } from "@/components/sections/about";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <About />
        
        {/* Placeholder sections - we'll build these next */}
        <section id="projects" className="min-h-screen py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-8">Projects</h2>
            <p className="text-muted-foreground">Coming in Day 5-7...</p>
          </div>
        </section>

        <section id="skills" className="min-h-screen py-24 px-6 bg-muted/30">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-8">Skills</h2>
            <p className="text-muted-foreground">Coming in Week 2...</p>
          </div>
        </section>

        <section id="contact" className="py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-8">Contact</h2>
            <p className="text-muted-foreground">Coming in Week 2...</p>
          </div>
        </section>
      </main>
    </>
  );
}