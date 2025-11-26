import { AppHeader } from "@/components/AppHeader";
import { Footer } from "@/components/Footer";
import { LayoutContainer } from "@/components/LayoutContainer";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <AppHeader currentStreak={0} />
      <main className="flex-1 py-12">
        <LayoutContainer className="prose dark:prose-invert max-w-2xl">{children}</LayoutContainer>
      </main>
      <Footer />
    </div>
  );
}
