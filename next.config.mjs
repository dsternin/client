/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    middlewareClientMaxBodySize: "50mb",
  },
};

export default nextConfig;
