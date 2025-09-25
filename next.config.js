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

  // 添加 headers 配置项来控制 HTTP 响应头
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // 设置合理的缓存策略
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable', // 静态资源建议缓存一年
          },
          // 清理不必要的 Vary header
          {
            key: 'Vary',
            value: 'Accept-Encoding, User-Agent',
          },
          // 移除 Next.js 默认暴露的技术栈信息
          {
            key: 'X-Powered-By',
            value: '',
          },
        ],
      },
    ];
  },
};

// 最后应用 next-intl 插件
module.exports = withNextIntl(nextConfig);