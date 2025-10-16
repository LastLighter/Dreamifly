# 使用官方 Node.js 20 Alpine 镜像
FROM base-mirror.tencentcloudcr.com/tekton/base/node:21-alpine AS base

# 设置工作目录
WORKDIR /app

# 设置环境变量
ENV DATABASE_URL=''
ENV Kontext_fp8_URL=''
ENV Flux_Krea_URL=''
ENV Qwen_Image_URL=''
ENV Qwen_Image_Edit_URL=''
ENV OPEN_AI_API=''
ENV MAX_TOKENS=2000
ENV Wai_SDXL_V150_URL=''
ENV NEXT_PUBLIC_BASE_URL=''


# 构建阶段
FROM base  AS builder


# 复制配置文件（这些文件变化较少，利于缓存）
COPY next.config.js ./
COPY tailwind.config.js ./
COPY postcss.config.js ./
COPY postcss.config.mjs ./
COPY tsconfig.json ./
COPY drizzle.config.json ./

# 复制源代码和必要的文件
COPY package.json package-lock.json ./
COPY public ./public
COPY src ./src
COPY drizzle ./drizzle
COPY middleware.ts ./
COPY eslint.config.mjs ./
COPY .env.local ./

RUN npm install

# 构建应用
RUN npm run build

# 生产运行阶段
FROM base AS runner

# 安装必要的系统工具
RUN apk add --no-cache curl

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# 复制构建结果
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# 复制必要的配置文件
COPY --from=builder --chown=nextjs:nodejs /app/next.config.js ./
COPY --from=builder --chown=nextjs:nodejs /app/middleware.ts ./

# 设置权限
RUN chown -R nextjs:nodejs /app

# 切换到非 root 用户
USER nextjs

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 启动应用
CMD ["npm", "start"]
