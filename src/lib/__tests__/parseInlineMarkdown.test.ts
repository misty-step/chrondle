import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { parseInlineMarkdown } from "../parseInlineMarkdown";

function renderInline(text: string) {
  return render(
    React.createElement("span", { "data-testid": "inline" }, ...parseInlineMarkdown(text)),
  );
}

describe("parseInlineMarkdown", () => {
  it("renders plain text", () => {
    renderInline("plain text");

    expect(screen.getByTestId("inline")).toHaveTextContent("plain text");
  });

  it("renders bold text with strong", () => {
    renderInline("**bold**");

    expect(screen.getByText("bold").tagName).toBe("STRONG");
  });

  it("renders italic text with underscores", () => {
    renderInline("_italic_");

    expect(screen.getByText("italic").tagName).toBe("EM");
  });

  it("renders italic text with asterisks", () => {
    renderInline("*italic*");

    expect(screen.getByText("italic").tagName).toBe("EM");
  });

  it("renders mixed bold and italic", () => {
    renderInline("**bold** and _italic_");

    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(screen.getByText("italic").tagName).toBe("EM");
  });

  it("renders nested formatting", () => {
    renderInline("nested **_bold italic_**");

    const strong = screen.getByText("bold italic").closest("strong");
    expect(strong).toBeInTheDocument();
    expect(strong?.querySelector("em")).toBeInTheDocument();
  });

  it("renders multiple bold sections", () => {
    renderInline("multiple **bold** words **here**");

    const inline = screen.getByTestId("inline");
    expect(inline.querySelectorAll("strong")).toHaveLength(2);
  });

  it("renders empty string as nothing", () => {
    renderInline("");

    expect(screen.getByTestId("inline")).toBeEmptyDOMElement();
  });

  it("renders non-formatted text as plain span content", () => {
    renderInline("no formatting here");

    const inline = screen.getByTestId("inline");
    expect(inline).toHaveTextContent("no formatting here");
    expect(inline.querySelector("strong")).toBeNull();
    expect(inline.querySelector("em")).toBeNull();
  });

  it("treats script tags as plain text and does not inject HTML", () => {
    const { container } = renderInline("<script>alert(1)</script>");

    expect(screen.getByTestId("inline")).toHaveTextContent("<script>alert(1)</script>");
    expect(container.querySelector("script")).toBeNull();
  });

  it("does not treat math asterisks as italic", () => {
    renderInline("100 * 200");

    const inline = screen.getByTestId("inline");
    expect(inline).toHaveTextContent("100 * 200");
    expect(inline.querySelector("em")).toBeNull();
  });

  it("does not treat double underscores as bold", () => {
    renderInline("__double underscore__");

    const inline = screen.getByTestId("inline");
    expect(inline).toHaveTextContent("__double underscore__");
    expect(inline.querySelector("strong")).toBeNull();
    expect(inline.querySelector("em")).toBeNull();
  });

  it("does not italicize intraword snake_case underscores", () => {
    renderInline("foo_bar_baz");

    const inline = screen.getByTestId("inline");
    expect(inline).toHaveTextContent("foo_bar_baz");
    expect(inline.querySelector("em")).toBeNull();
  });

  it("does not italicize env var style identifiers like NEXT_PUBLIC_APP_URL", () => {
    renderInline("NEXT_PUBLIC_APP_URL");

    const inline = screen.getByTestId("inline");
    expect(inline).toHaveTextContent("NEXT_PUBLIC_APP_URL");
    expect(inline.querySelector("em")).toBeNull();
  });

  it("still italicizes standalone _word_ surrounded by spaces", () => {
    renderInline("use _emphasis_ here");

    expect(screen.getByText("emphasis").tagName).toBe("EM");
  });
});
