/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  async redirects() {
    return [{ source: "/index-two", destination: "/", permanent: true }];
  },
};

module.exports = nextConfig;
