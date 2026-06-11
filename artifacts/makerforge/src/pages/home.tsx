import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronRight, Cpu, Rocket, BookOpen, Layers } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col items-center">
      {/* Hero Section */}
      <section className="w-full py-20 md:py-32 flex flex-col items-center text-center relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background -z-10" />
        
        <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm text-primary mb-8 animate-in fade-in slide-in-from-bottom-4">
          <Cpu className="mr-2 h-4 w-4" />
          <span className="font-mono">v1.0 is live</span>
        </div>
        
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tighter mb-6 max-w-4xl text-foreground">
          Describe it. <br/><span className="text-primary">Forge it.</span> Make it.
        </h1>
        
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10">
          The GitHub Copilot for makers. Turn natural language hardware ideas into complete, buildable project packages in seconds.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center max-w-md">
          <Button size="lg" className="w-full sm:w-auto text-primary-foreground font-semibold" asChild>
            <Link href="/sign-up">
              Start Forging <ChevronRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="w-full sm:w-auto border-border hover:bg-secondary" asChild>
            <Link href="/gallery">
              Explore Gallery
            </Link>
          </Button>
        </div>

        {/* Terminal/Typewriter Demo */}
        <div className="mt-16 w-full max-w-3xl rounded-xl border border-border bg-card shadow-2xl overflow-hidden relative">
          <div className="flex items-center px-4 py-2 border-b border-border bg-secondary/50">
            <div className="flex space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
            </div>
            <div className="mx-auto text-xs text-muted-foreground font-mono">makerforge ~ prompt</div>
          </div>
          <div className="p-6 text-left font-mono text-sm md:text-base text-slate-300">
            <span className="text-primary">❯</span> <span className="animate-pulse">_</span>
            <span className="opacity-80">portable solar charger with 10,000mAh USB-C PD for hiking...</span>
            <br/><br/>
            <div className="text-muted-foreground mt-2 opacity-60">
              <p>[*] Generating OpenSCAD models...</p>
              <p>[*] Compiling KiCad electronics schematic...</p>
              <p>[*] Optimizing Bill of Materials...</p>
              <p className="text-primary mt-2">Project ready. 12 components. Est cost: $42.50.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Section */}
      <section className="w-full py-20 border-t border-border/50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="p-6 rounded-2xl bg-card border border-border hover:border-primary/50 transition-colors">
            <Layers className="h-10 w-10 text-primary mb-4" />
            <h3 className="text-xl font-bold mb-2">Complete Packages</h3>
            <p className="text-muted-foreground">Get everything you need: 3D models, schematics, wiring guides, and tiered BOMs.</p>
          </div>
          <div className="p-6 rounded-2xl bg-card border border-border hover:border-primary/50 transition-colors">
            <Rocket className="h-10 w-10 text-primary mb-4" />
            <h3 className="text-xl font-bold mb-2">Iterative Refinement</h3>
            <p className="text-muted-foreground">Don't like a part? Ask the AI to "make it cheaper" or "use larger buttons" and watch it update.</p>
          </div>
          <div className="p-6 rounded-2xl bg-card border border-border hover:border-primary/50 transition-colors">
            <BookOpen className="h-10 w-10 text-primary mb-4" />
            <h3 className="text-xl font-bold mb-2">Education Ready</h3>
            <p className="text-muted-foreground">Generate STEM lesson plans, NGSS alignments, and printable worksheets for any project.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
