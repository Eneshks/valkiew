import type { NextConfig } from 'next';

// Statik dışa aktarım: `npm run build` sonrası `out/` klasörü herhangi bir sunucuda yayınlanabilir.
const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
};

export default nextConfig;
