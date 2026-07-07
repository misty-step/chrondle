import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";

// NOTE: This file renders a static OG image via Satori, which cannot resolve
// CSS custom properties. The literal color values below are approved asset
// data (mirroring the design tokens in globals.css), not component styling.
export const runtime = "edge";

export const alt = "Chrondle daily history puzzle preview";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "space-between",
        backgroundColor: "#fbfaf7",
        fontFamily: "sans-serif",
        position: "relative",
        overflow: "hidden",
        padding: "72px 80px 58px",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "10px",
          backgroundColor: "#ea5a1b",
          display: "flex",
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            fontSize: "34px",
            fontWeight: 600,
            color: "#1a1a1b",
            letterSpacing: "0.14em",
            lineHeight: 1,
            display: "flex",
          }}
        >
          CHRONDLE
        </div>

        <div
          style={{
            border: "2px solid #1a1a1b",
            borderRadius: "999px",
            padding: "9px 16px",
            fontSize: "18px",
            fontWeight: 600,
            color: "#1a1a1b",
            display: "flex",
          }}
        >
          FREE DAILY GAME
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "22px",
          maxWidth: "890px",
        }}
      >
        <div
          style={{
            fontSize: "23px",
            fontWeight: 600,
            color: "#ea5a1b",
            letterSpacing: "0.13em",
            textTransform: "uppercase",
            display: "flex",
          }}
        >
          Daily history puzzle
        </div>

        <div
          style={{
            fontSize: "76px",
            fontWeight: 600,
            color: "#1a1a1b",
            letterSpacing: "0",
            lineHeight: 0.96,
            display: "flex",
          }}
        >
          Read the clues. Guess the year.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: "16px",
          width: "100%",
        }}
      >
        <div
          style={{
            flex: 1,
            minHeight: "112px",
            border: "2px solid #d9d4ca",
            borderRadius: "8px",
            backgroundColor: "#ffffff",
            padding: "22px 24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ color: "#ea5a1b", fontSize: "20px", fontWeight: 600, display: "flex" }}>
            1
          </div>
          <div style={{ color: "#1a1a1b", fontSize: "26px", fontWeight: 600, display: "flex" }}>
            One real event
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: "112px",
            border: "2px solid #d9d4ca",
            borderRadius: "8px",
            backgroundColor: "#ffffff",
            padding: "22px 24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ color: "#1f6feb", fontSize: "20px", fontWeight: 600, display: "flex" }}>
            2
          </div>
          <div style={{ color: "#1a1a1b", fontSize: "26px", fontWeight: 600, display: "flex" }}>
            Six clues
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: "112px",
            border: "2px solid #d9d4ca",
            borderRadius: "8px",
            backgroundColor: "#ffffff",
            padding: "22px 24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ color: "#188a5d", fontSize: "20px", fontWeight: 600, display: "flex" }}>
            3
          </div>
          <div style={{ color: "#1a1a1b", fontSize: "26px", fontWeight: 600, display: "flex" }}>
            Score your range
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          color: "#6f6b63",
          fontSize: "24px",
          fontWeight: 500,
        }}
      >
        <div style={{ display: "flex" }}>One real event per day</div>
        <div style={{ display: "flex" }}>{siteConfig.url.replace("https://", "")}</div>
      </div>
    </div>,
    size,
  );
}
