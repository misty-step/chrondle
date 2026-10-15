import { Fragment } from "react";
import { InlineMarkdown } from "@/components/kit/InlineMarkdown";

/** Render public generated notes as text, never as raw HTML or executable URLs. */
function NoteText({ children }: { children: string }) {
  const links = /\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g;
  const parts = [];
  let cursor = 0;
  for (const match of children.matchAll(links)) {
    const index = match.index;
    parts.push(
      <InlineMarkdown key={`text-${index}`}>{children.slice(cursor, index)}</InlineMarkdown>,
    );
    parts.push(
      <a key={index} href={match[2]} className="underline underline-offset-4">
        <InlineMarkdown>{match[1]}</InlineMarkdown>
      </a>,
    );
    cursor = index + match[0].length;
  }
  return (
    <>
      {parts}
      <InlineMarkdown>{children.slice(cursor)}</InlineMarkdown>
    </>
  );
}

export function ReleaseNotes({ notes }: { notes: string }) {
  return (
    <div className="space-y-4 text-base leading-relaxed [overflow-wrap:anywhere] break-words">
      {notes.split(/\n{2,}/).map((block, index) => (
        <Fragment key={index}>
          {block.startsWith("### ") ? (
            <h2 className="font-heading pt-2 text-xl font-semibold">
              <NoteText>{block.replace(/^#+ /, "")}</NoteText>
            </h2>
          ) : /^[-*] /.test(block) ? (
            <ul className="list-disc space-y-2 pl-5">
              {block.split(/\n(?=[-*] )/).map((item, itemIndex) => (
                <li key={itemIndex}>
                  <NoteText>{item.replace(/^[-*] /, "")}</NoteText>
                </li>
              ))}
            </ul>
          ) : (
            <p className="whitespace-pre-wrap">
              <NoteText>{block}</NoteText>
            </p>
          )}
        </Fragment>
      ))}
    </div>
  );
}
