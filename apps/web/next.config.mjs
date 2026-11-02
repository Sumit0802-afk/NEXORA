/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets a second dev server or a build use its own folder (NEXT_DIST_DIR=.next-test) without corrupting a running one.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  transpilePackages: ["@houseplan/design-schema"],
  // In production the browser talks to this site's own /api and Next forwards it to the API host (API_PROXY_TARGET).
  // That keeps the login cookie first-party, which a separate *.onrender.com API origin could not (SameSite=Lax).
  async rewrites() {
    const target = process.env.API_PROXY_TARGET;
    return target ? [{ source: "/api/:path*", destination: `${target.replace(/\/$/, "")}/api/:path*` }] : [];
  },
  // Next's own inline scripts rule out a strict script policy; these directives block framing and injected bases or plugins.
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      ],
    }];
  },
  webpack: (config) => {
    config.externals = [...(config.externals ?? []), { canvas: "commonjs canvas" }];
    return config;
  }
};
export default nextConfig;
