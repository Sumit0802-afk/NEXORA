/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@houseplan/design-schema"],
  webpack: (config) => {
    config.externals = [...(config.externals ?? []), { canvas: "commonjs canvas" }];
    return config;
  }
};
export default nextConfig;
