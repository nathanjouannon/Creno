import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@creno/validation'],
  poweredByHeader: false,
  // Self-contained server for the Docker image (docs/architecture/environments.md); the workspace root is traced so
  // packages/* and the Prisma engine are included.
  output: 'standalone',
  outputFileTracingRoot: resolve(dirname(fileURLToPath(import.meta.url)), '../..'),
};

export default nextConfig;
