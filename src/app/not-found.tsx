import Link from "next/link";
import { LayoutContainer } from "@/components/LayoutContainer";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="bg-surface-primary relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden">
      {/* Texture Overlay */}
      <div className="bg-texture-noise pointer-events-none absolute inset-0 opacity-20 mix-blend-multiply" />

      {/* Background Ambience */}
      <div className="text-surface-elevated font-display pointer-events-none absolute top-1/2 left-1/2 -z-0 -translate-x-1/2 -translate-y-1/2 text-[25vw] leading-none opacity-50 blur-3xl select-none dark:opacity-5">
        404
      </div>

      <LayoutContainer className="relative z-10 flex flex-col items-center text-center">
        {/* Minimal Display */}
        <div className="mb-12 space-y-2">
          <h1 className="text-archival-hero text-primary font-display leading-none">404</h1>
          <p className="text-muted-foreground font-serif text-xl tracking-wide italic">
            Page Not Found
          </p>
        </div>

        {/* Single CTA */}
        <Button asChild size="lg" className="min-w-[200px] font-serif">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Return Home
          </Link>
        </Button>
      </LayoutContainer>
    </div>
  );
}
