const withNextIntl = require('next-intl/plugin')('./src/i18n.ts');

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // 替换为具体域名更安全
      },
    ],
  },

  // 根据资源类型设置合适的缓存策略，避免页面/JS 长时间不更新
  async headers() {
    return [
      // 页面与 API，禁止中长期缓存
      {
        source: '/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
          { key: 'Vary', value: 'Accept-Encoding, User-Agent' },
          { key: 'X-Powered-By', value: '' },
        ],
      },
      // Next.js 构建产物可长时间缓存
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'Vary', value: 'Accept-Encoding' },
        ],
      },
    ];
  },

  // 实验性配置：确保构建稳定性
  experimental: {
    // 禁用一些可能导致构建问题的特性
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // 修复构建时的 .nft.json 和 trace 文件错误
  // 优化输出文件跟踪，排除可能导致权限问题的目录
  outputFileTracingExcludes: {
    '*': [
      '**/.git/**',
      '**/.next/**',
      '**/node_modules/**',
      '**/.cache/**',
      '**/trace',
      '**/trace/**',
    ],
  },
};

// 最后应用 next-intl 插件
module.exports = withNextIntl(nextConfig);