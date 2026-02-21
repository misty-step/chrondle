import React from "react";
import { parseInlineMarkdown } from "@/lib/parseInlineMarkdown";
import { cn } from "@/lib/utils";

interface InlineMarkdownProps {
  children: string;
  className?: string;
}

export function InlineMarkdown({ children, className }: InlineMarkdownProps) {
  return <span className={cn(className)}>{parseInlineMarkdown(children)}</span>;
}
