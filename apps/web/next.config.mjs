/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets a second dev server or a build use its own folder (NEXT_DIST_DIR=.next-test) without corrupting a running one.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  transpilePackages: ["@houseplan/design-schema"],
  webpack: (config) => {
    config.externals = [...(config.externals ?? []), { canvas: "commonjs canvas" }];
    return config;
  }
};
export default nextConfig;
