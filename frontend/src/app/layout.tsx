import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SeekMate", template: "%s | SeekMate" },
  description: "Cari teman sekelas dan partner belajar sebelum KRS.",
  applicationName: "SeekMate",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0e1017" },
    { media: "(prefers-color-scheme: light)", color: "#e9edf6" },
  ],
};

// Runs before paint so the stored theme never flashes.
const themeScript = `try{document.documentElement.dataset.theme=localStorage.getItem("seekmate-theme")==="light"?"light":"dark"}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
