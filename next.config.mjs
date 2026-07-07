/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // @react-pdf/renderer must run in Node, not be bundled for the edge.
    serverComponentsExternalPackages: ["@react-pdf/renderer"],
  },
  // Serve runtime-uploaded images (public/ isn't served for post-build files).
  async rewrites() {
    return {
      beforeFiles: [{ source: "/uploads/:path*", destination: "/api/uploads/:path*" }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
