/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bygger en selvstendig Node-server i .next/standalone slik at Docker-imaget
  // kan kjøre uten node_modules. Se Dockerfile / README.
  output: "standalone"
};

export default nextConfig;
