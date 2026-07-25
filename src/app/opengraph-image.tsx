import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_SLOGAN } from "@/lib/constants";

/*
 * The share card, generated rather than exported as a flat PNG so it tracks
 * SITE_NAME and SITE_SLOGAN — both still unsettled — instead of going stale
 * the moment either changes.
 *
 * Design: the card is built as a length of steel tape rather than a wordmark
 * floating in the middle of a blank field. The tick rule runs the full width
 * along the bottom, and the verdigris dimension line above it measures a span
 * against those ticks — which is what the slogan is describing. The wordmark
 * glyph at the top is the same tape graduation used in the site header.
 *
 * Type matches the site: one family, Bricolage Grotesque, at two weights.
 * Satori (behind ImageResponse) has no access to next/font and can't read
 * the .woff2 it emits, so the weights are read off disk as .woff.
 */

export const alt = `${SITE_NAME} — ${SITE_SLOGAN}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const COLOR = {
  galvanise: "#eceeea",
  paper: "#f8f9f7",
  zincDust: "#d5dad3",
  slateWash: "#58655f",
  millscale: "#151d1a",
  verdigris: "#2b6b5d",
};

/** Matches the on-page rule: a minor tick every 16px, a major every 80px. */
const TICK_PITCH = 16;
const TICK_COUNT = Math.ceil(size.width / TICK_PITCH);

function fontFile(pkg: string, file: string) {
  return path.join(process.cwd(), "node_modules", pkg, "files", file);
}

export default async function OpengraphImage() {
  const [bold, regular] = await Promise.all([
    readFile(
      fontFile(
        "@fontsource/bricolage-grotesque",
        "bricolage-grotesque-latin-700-normal.woff",
      ),
    ),
    readFile(
      fontFile(
        "@fontsource/bricolage-grotesque",
        "bricolage-grotesque-latin-400-normal.woff",
      ),
    ),
  ]);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: COLOR.galvanise,
        borderLeft: `16px solid ${COLOR.verdigris}`,
      }}
    >
      {/* Wordmark: tape glyph plus the name, same construction as the header. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "64px 80px 0",
        }}
      >
        <div
          style={{
            display: "flex",
            position: "relative",
            width: 46,
            height: 34,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: 46,
              height: 4,
              backgroundColor: COLOR.verdigris,
            }}
          />
          {[
            { x: 0, h: 22 },
            { x: 14, h: 12 },
            { x: 28, h: 12 },
            { x: 42, h: 22 },
          ].map(({ x, h }) => (
            <div
              key={x}
              style={{
                position: "absolute",
                left: x,
                top: 0,
                width: 4,
                height: h,
                backgroundColor: COLOR.verdigris,
              }}
            />
          ))}
        </div>
        <div
          style={{
            fontFamily: "Brand",
            fontWeight: 700,
            fontSize: 40,
            letterSpacing: "-0.03em",
            color: COLOR.millscale,
          }}
        >
          {SITE_NAME}
        </div>
      </div>

      {/* The line itself. */}
      <div
        style={{ display: "flex", flexDirection: "column", padding: "0 80px" }}
      >
        <div
          style={{
            display: "flex",
            fontFamily: "Brand",
            fontWeight: 700,
            fontSize: 82,
            lineHeight: 1.05,
            letterSpacing: "-0.035em",
            color: COLOR.millscale,
            maxWidth: 880,
          }}
        >
          {SITE_SLOGAN}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontFamily: "Brand",
            // Regular weight plus wide tracking carries the technical
            // annotation feel that the mono face used to provide.
            fontWeight: 400,
            fontSize: 21,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: COLOR.slateWash,
          }}
        >
          ISNetworld &amp; Avetta prequalification
        </div>
      </div>

      {/* Dimension line measuring a span against the rule below it. */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "0 80px",
            marginBottom: 26,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 4,
              height: 26,
              backgroundColor: COLOR.verdigris,
            }}
          />
          <div
            style={{
              display: "flex",
              width: 476,
              height: 4,
              backgroundColor: COLOR.verdigris,
            }}
          />
          <div
            style={{
              display: "flex",
              width: 4,
              height: 26,
              backgroundColor: COLOR.verdigris,
            }}
          />
        </div>

        {/* Full-bleed tick rule. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              width: "100%",
              height: 2,
              backgroundColor: COLOR.zincDust,
            }}
          />
          <div style={{ display: "flex", height: 34 }}>
            {Array.from({ length: TICK_COUNT }, (_, i) => {
              const isMajor = i % 5 === 0;
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    width: 2,
                    marginRight: TICK_PITCH - 2,
                    height: isMajor ? 34 : 15,
                    backgroundColor: isMajor ? COLOR.slateWash : COLOR.zincDust,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Brand", data: bold, style: "normal", weight: 700 },
        { name: "Brand", data: regular, style: "normal", weight: 400 },
      ],
    },
  );
}
