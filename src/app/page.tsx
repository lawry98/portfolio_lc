import { Navbar } from "@/components/sections/navbar";
import { Hero } from "@/components/sections/hero";
import { About } from "@/components/sections/about";
import { Projects } from "@/components/sections/projects";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <About />
        <Projects />

        {/* Placeholder sections - Week 2 */}
        <section id="skills" className="py-24 px-6 bg-muted/30">
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