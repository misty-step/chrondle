"use client";

import React from "react";
import Markdown from "react-markdown";
import { cn } from "@/lib/utils";

interface HintTextProps {
  children: string;
  className?: string;
}

/**
 * HintText component renders markdown-formatted text for historical hints
 * Supports basic formatting like *italics* and **bold**
 * Restricted to safe inline elements only
 */
export const HintText: React.FC<HintTextProps> = React.memo(({ children, className }) => {
  return (
    <div className={cn("hint-text", className)}>
      <Markdown
        components={{
          // Only allow safe inline elements
          p: ({ children }) => <span>{children}</span>,
          em: ({ children }) => <em className="italic">{children}</em>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          // Disable all other elements for security
          h1: ({ children }) => <span>{children}</span>,
          h2: ({ children }) => <span>{children}</span>,
          h3: ({ children }) => <span>{children}</span>,
          h4: ({ children }) => <span>{children}</span>,
          h5: ({ children }) => <span>{children}</span>,
          h6: ({ children }) => <span>{children}</span>,
          blockquote: ({ children }) => <span>{children}</span>,
          ul: ({ children }) => <span>{children}</span>,
          ol: ({ children }) => <span>{children}</span>,
          li: ({ children }) => <span>{children}</span>,
          a: ({ children }) => <span>{children}</span>,
          img: () => null,
          code: ({ children }) => <code className="font-mono text-sm">{children}</code>,
          pre: ({ children }) => <span>{children}</span>,
        }}
        // Security: disable HTML and limit to basic markdown
        disallowedElements={["script", "iframe", "object", "embed", "link"]}
        unwrapDisallowed={true}
        skipHtml={true}
      >
        {children || ""}
      </Markdown>
    </div>
  );
});

HintText.displayName = "HintText";
