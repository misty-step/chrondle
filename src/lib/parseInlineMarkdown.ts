import React from "react";

const INLINE_MARKDOWN_PATTERN = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(_(.+?)_)/g;

function parseSegments(text: string, keyPrefix: string): React.ReactNode[] {
  if (!text) return [];

  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(INLINE_MARKDOWN_PATTERN)) {
    const fullMatch = match[0];
    const index = match.index ?? 0;

    if (index > cursor) {
      nodes.push(text.slice(cursor, index));
    }

    const key = `${keyPrefix}-${index}`;

    if (match[1]) {
      nodes.push(
        React.createElement(
          "strong",
          { key, className: "font-semibold" },
          ...parseSegments(match[2], key),
        ),
      );
    } else if (match[3]) {
      nodes.push(
        React.createElement("em", { key, className: "italic" }, ...parseSegments(match[4], key)),
      );
    } else if (match[5]) {
      const previousChar = text[index - 1];
      const nextChar = text[index + fullMatch.length];

      if (previousChar === "_" || nextChar === "_") {
        nodes.push(fullMatch);
      } else {
        nodes.push(
          React.createElement("em", { key, className: "italic" }, ...parseSegments(match[6], key)),
        );
      }
    }

    cursor = index + fullMatch.length;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}

export function parseInlineMarkdown(text: string): React.ReactNode[] {
  return parseSegments(text, "inline");
}
