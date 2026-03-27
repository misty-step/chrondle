import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Chrondle - The Daily History Game";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const outfitFont = await fetch(
    new URL("https://fonts.gstatic.com/s/outfit/v11/QGYyz_MVcBeNP4NjuGObqx1XmO1I4TC1O4a0Ew.woff"),
  ).then((res) => res.arrayBuffer());

  const outfitMedium = await fetch(
    new URL("https://fonts.gstatic.com/s/outfit/v11/QGYyz_MVcBeNP4NjuGObqx1XmO1I4bK0O4a0Ew.woff"),
  ).then((res) => res.arrayBuffer());

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#ffffff",
        fontFamily: "Outfit",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle warm gradient overlay */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(234, 90, 27, 0.04) 0%, transparent 70%)",
          display: "flex",
        }}
      />

      {/* Top accent line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "4px",
          backgroundColor: "#ea5a1b",
          display: "flex",
        }}
      />

      {/* Corner marks - archival/editorial touch */}
      <div
        style={{
          position: "absolute",
          top: "40px",
          left: "48px",
          width: "24px",
          height: "24px",
          borderLeft: "2px solid #d3d6da",
          borderTop: "2px solid #d3d6da",
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "40px",
          right: "48px",
          width: "24px",
          height: "24px",
          borderRight: "2px solid #d3d6da",
          borderTop: "2px solid #d3d6da",
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "40px",
          left: "48px",
          width: "24px",
          height: "24px",
          borderLeft: "2px solid #d3d6da",
          borderBottom: "2px solid #d3d6da",
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "40px",
          right: "48px",
          width: "24px",
          height: "24px",
          borderRight: "2px solid #d3d6da",
          borderBottom: "2px solid #d3d6da",
          display: "flex",
        }}
      />

      {/* Main content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0px",
        }}
      >
        {/* Logo icon - calendar with check */}
        <svg width="64" height="64" viewBox="0 0 256 256" style={{ marginBottom: "28px" }}>
          <path
            d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Zm-38.34-85.66a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L116,164.69l42.34-42.35A8,8,0,0,1,169.66,122.34Z"
            fill="#ea5a1b"
          />
        </svg>

        {/* Brand name */}
        <div
          style={{
            fontSize: "72px",
            fontWeight: 600,
            color: "#1a1a1b",
            letterSpacing: "0.12em",
            lineHeight: 1,
            display: "flex",
          }}
        >
          CHRONDLE
        </div>

        {/* Divider */}
        <div
          style={{
            width: "48px",
            height: "2px",
            backgroundColor: "#ea5a1b",
            marginTop: "24px",
            marginBottom: "24px",
            display: "flex",
          }}
        />

        {/* Tagline */}
        <div
          style={{
            fontSize: "24px",
            fontWeight: 500,
            color: "#787c7e",
            letterSpacing: "0.05em",
            display: "flex",
          }}
        >
          The Daily History Game
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: "15px",
            fontWeight: 400,
            color: "#9ca3af",
            letterSpacing: "0.16em",
            marginTop: "16px",
            textTransform: "uppercase" as const,
            display: "flex",
          }}
        >
          Guess the year from six historical clues
        </div>
      </div>

      {/* Bottom domain */}
      <div
        style={{
          position: "absolute",
          bottom: "48px",
          fontSize: "14px",
          fontWeight: 400,
          color: "#d3d6da",
          letterSpacing: "0.08em",
          display: "flex",
        }}
      >
        chrondle.app
      </div>
    </div>,
    {
      ...size,
      fonts: [
        {
          name: "Outfit",
          data: outfitFont,
          style: "normal",
          weight: 600,
        },
        {
          name: "Outfit",
          data: outfitMedium,
          style: "normal",
          weight: 500,
        },
      ],
    },
  );
}
