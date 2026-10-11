// adapted from https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image

import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// image metadata
export const contentType = "image/png";
export const alt = "Builds";
export const size = {
  width: 1200,
  height: 630,
};

// needs to be a default export
export default async function GET() {
  const assetPath = join(process.cwd(), "public/og-background.png");
  const fileBuffer = await readFile(assetPath);
  const base64Image = fileBuffer.toString("base64");
  const dataUri = `data:image/png;base64,${base64Image}`;

  // const Spacer = () => <div style={{ width: "2px" }} />;

  return new ImageResponse(
    <div
      style={{
        position: "relative",
        fontSize: 64,
        letterSpacing: "-0.02em",
        textAlign: "center",
        padding: "0px 64px",
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#000",
        color: "#fff",
        backgroundImage: `url(${dataUri})`,
        backgroundSize: "cover",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "#000",
          opacity: 0.1,
        }}
      />
      <div style={{ display: "flex" }}>Builds</div>
    </div>,
    {
      // for convenience, we can re-use the exported opengraph-image
      // size config to also set the ImageResponse's width and height
      ...size,
    }
  );
}
