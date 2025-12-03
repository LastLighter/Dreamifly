# 使用官方 Node.js 22 Alpine 镜像
# FROM node:22-alpine AS base
FROM base-mirror.tencentcloudcr.com/tekton/base/node:21-alpine AS base

# 设置工作目录
WORKDIR /app

# 设置环境变量
ENV DATABASE_URL=''

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
COPY .env ./
COPY fonts ./fonts

RUN npm install --registry=http://nexus.suanleme.local:8081/repository/npm

# 构建应用
RUN npm run build

# 生产运行阶段
FROM base AS runner

# 安装必要的系统工具
RUN apk add --no-cache curl

# 复制构建结果
COPY --from=builder  /app/.next ./.next
COPY --from=builder  /app/public ./public
COPY --from=builder  /app/node_modules ./node_modules
COPY --from=builder  /app/package.json ./package.json

# 复制必要的配置文件和字体文件
COPY --from=builder  /app/next.config.js ./
COPY --from=builder  /app/middleware.ts ./
COPY --from=builder  /app/fonts ./fonts

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 启动应用
CMD ["npm", "start"]
