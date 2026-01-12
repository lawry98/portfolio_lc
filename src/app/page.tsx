import { FadeIn } from "@/components/animations/fade-in";

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero Section Placeholder */}
      <section className="h-screen flex items-center justify-center">
        <FadeIn>
          <div className="text-center">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
              Lawry
            </h1>
            <p className="mt-4 text-xl text-muted-foreground">
              Software Developer
            </p>
          </div>
        </FadeIn>
      </section>

      {/* Projects Section Placeholder */}
      <section className="min-h-screen py-24 px-6">
        <FadeIn>
          <h2 className="text-3xl font-bold text-center mb-12">Projects</h2>
        </FadeIn>
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <div className="h-64 rounded-xl bg-muted animate-pulse" />
            </FadeIn>
          ))}
        </div>
      </section>
    </main>
  );
}