import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/beranda",
    name: "SeekMate",
    short_name: "SeekMate",
    description: "Cari teman sekelas dan partner belajar sebelum KRS.",
    lang: "id",
    start_url: "/beranda",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#14161f",
    theme_color: "#0e1017",
    categories: ["education", "social"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Jelajah", url: "/jelajah" },
      { name: "Notifikasi", url: "/notifikasi" },
    ],
  };
}
