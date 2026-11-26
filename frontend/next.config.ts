import type { NextConfig } from "next";

const backend = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  devIndicators: false,
  // Lets two accounts be tested side by side in dev (separate cookie jars).
  allowedDevOrigins: ["127.0.0.1"],
  // Same-origin API: the refresh cookie stays first-party and no CORS preflight is needed.
  rewrites: async () => [{ source: "/api/v1/:path*", destination: `${backend}/api/v1/:path*` }],
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "same-origin" },
      ],
    },
  ],
};

export default config;
