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
  webpack: (config) => {
    config.externals = [...(config.externals ?? []), { canvas: "commonjs canvas" }];
    return config;
  }
};
export default nextConfig;
