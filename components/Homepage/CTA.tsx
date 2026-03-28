"use client";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";

const CTA = () => {
  const router = useRouter();


  return (
    <section className="section-padding bg-foreground text-primary-foreground relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03]">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-white" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-white" />
      </div>

      <div className="container-wide relative">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl mb-6 tracking-tight">
            Ready to transform your
            <br />
            <span className="italic">social media workflow?</span>
          </h2>

          <p className="text-lg sm:text-xl text-primary-foreground/70 max-w-2xl mx-auto mb-10 leading-relaxed">
            Join 50,000+ marketing teams who've automated their content distribution and
            reclaimed hours of their week. Start free—no credit card required.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
            <Button onClick={() => router.push("/signup")}
              variant="accent" size="xl" className="group shadow-lg">
              Start your free trial
              <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </Button>
            <Button onClick={() => router.push("/signup")}
              size="xl"
              className="border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
            >
              Schedule a demo
            </Button>
          </div>

        </div>
      </div>
    </section>
  );
};

export default CTA;
