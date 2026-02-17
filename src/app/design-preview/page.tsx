import { notFound } from "next/navigation";
import DesignPreviewClient from "./DesignPreviewClient";

/**
 * Design Catalogue Page for Chrondle
 *
 * A comprehensive visual comparison of 5 design variations for stakeholder review.
 * Each variation shows the same content (clue card + hint button + guess input)
 * styled differently to demonstrate aesthetic options.
 *
 * Features:
 * - Sticky header with dark mode toggle
 * - Side-by-side light/dark mode previews for each variation
 * - Fully responsive (stacks on mobile)
 * - Production-quality styling with Tailwind CSS
 */
export default function DesignPreviewPage() {
  const isProdDeployment =
    process.env.VERCEL_ENV === "production" ||
    (process.env.VERCEL_ENV === undefined && process.env.NODE_ENV === "production");
  const allowPreviewInProd = process.env.ENABLE_DESIGN_PREVIEW === "true";

  if (isProdDeployment && !allowPreviewInProd) {
    notFound();
  }

  return <DesignPreviewClient />;
}
