import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The e2e-ui compose service loads the app cross-container as http://dev:3000, and Next's
  // dev server blocks non-localhost hosts by default (DNS-rebinding protection). Dev-only —
  // has no effect on the production build.
  allowedDevOrigins: ["dev"],
};

export default nextConfig;
