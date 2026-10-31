import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Connect Team",
    short_name: "Connect",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#217f74",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
