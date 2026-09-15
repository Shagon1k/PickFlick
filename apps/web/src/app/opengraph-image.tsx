import { ImageResponse } from "next/og";

export const alt = "PickFlick — choose a film together";
export const contentType = "image/png";
export const size = { height: 630, width: 1200 };

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#0c0c0c",
          color: "#f2eee8",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          overflow: "hidden",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            background: "radial-gradient(circle, rgba(200,155,85,.24), rgba(12,12,12,0) 68%)",
            display: "flex",
            height: 780,
            left: 210,
            position: "absolute",
            top: -230,
            width: 780,
          }}
        />
        <div
          style={{
            border: "2px solid #393633",
            display: "flex",
            height: 470,
            left: 64,
            position: "absolute",
            top: 80,
            width: 1072,
          }}
        />
        <div style={{ alignItems: "center", display: "flex", flexDirection: "column" }}>
          <div style={{ color: "#c89b55", display: "flex", fontSize: 24, letterSpacing: 8 }}>
            TONIGHT&apos;S FEATURE
          </div>
          <div style={{ display: "flex", fontFamily: "Georgia", fontSize: 116, marginTop: 28 }}>
            PickFlick
          </div>
          <div style={{ color: "#a6a19c", display: "flex", fontSize: 34, marginTop: 22 }}>
            Pick a film. Watch together. Remember everything.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
