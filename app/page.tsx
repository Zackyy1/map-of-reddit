"use client";

import dynamic from "next/dynamic";

const WorldMap = dynamic(() => import("@/app/components/WorldMap"), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center w-full h-screen"
      style={{ background: "#0d1117" }}
    >
      <div className="text-center">
        <h1 className="text-xl font-bold text-white mb-2">
          <span style={{ color: "#FF4500" }}>Reddit</span> Map
        </h1>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
          Loading map data…
        </p>
      </div>
    </div>
  ),
});

export default function Home() {
  return <WorldMap />;
}
