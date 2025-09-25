export default function sitemap() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://dreamifly.com'; // 从环境变量读取

  return [
    {
      url: `${baseUrl}/zh`,
      lastModified: new Date(),
    }, {
      url: `${baseUrl}/en`,
      lastModified: new Date(),
    }, {
      url: `${baseUrl}/zh-TW`,
      lastModified: new Date(),
    },
  ];
}