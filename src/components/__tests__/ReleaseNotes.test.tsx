import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReleaseNotes } from "../ReleaseNotes";

describe("ReleaseNotes", () => {
  it("renders generated headings, bullets, emphasis and real HTTPS provenance links", () => {
    render(
      <ReleaseNotes
        notes={
          "### Bug Fixes\n\n* **input:** keep drafts ([#12](https://github.com/example/app/issues/12))\n* Preserve games.\n\nMigration instructions."
        }
      />,
    );
    expect(screen.getByRole("heading", { name: "Bug Fixes" })).toBeVisible();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("input:").tagName).toBe("STRONG");
    expect(screen.getByRole("link", { name: "#12" })).toHaveAttribute(
      "href",
      "https://github.com/example/app/issues/12",
    );
    expect(screen.getByText("Migration instructions.")).toBeVisible();
  });

  it("escapes HTML and refuses executable or protocol-relative links", () => {
    const { container } = render(
      <ReleaseNotes
        notes={
          "<script>window.bad=true</script>\n\n[bad](javascript:alert(1)) [bad](//evil.example) <img src=x onerror=alert(1)>"
        }
      />,
    );
    expect(container.querySelector("script, img")).toBeNull();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(container.textContent).toContain("<script>");
  });
});
