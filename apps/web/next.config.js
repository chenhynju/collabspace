/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR || '.next',
  experimental: { outputFileTracingRoot: require('path').join(__dirname, '../..') },
  // Docker 部署用：产物自带 node_modules 裁剪，next start 免装依赖
  // Windows without Developer Mode cannot create standalone symlinks.
  // Linux container builds retain standalone output.
  output: process.platform === 'win32' ? undefined : 'standalone',
  webpack(config) {
    // Both Tiptap and the provider must use the same Yjs constructors.
    config.resolve.alias['yjs$'] = require('path').join(require('path').dirname(require.resolve('yjs')), 'yjs.mjs');
    return config;
  },
};
module.exports = nextConfig;
