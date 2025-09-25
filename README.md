# Dreamify - Free AI Art Generator Online | One-Click Anime, Illustration, and Art Creation

![Dreamify Logo](https://dreamifly.com/images/dreamifly-logo.jpg)

> **Dreamify** 是一个基于 **Next.js** 与 **ComfyUI API** 的开源 AI 图像生成平台，支持文生图（Text-to-Image）和图生图（Image-to-Image），无需注册、完全免费，专为开发者与创意者打造。

---

## 🚀 项目简介

Dreamify 是一个轻量级、高性能的 AI 绘画网站模板，集成多种先进 AI 模型（如 **HiDream-I1**、**Flux.1-Dev**、**Stable Diffusion 3.5**、**Qwen-Image** 等），通过调用 ComfyUI 后端 API 实现秒级图像生成。项目采用现代 Web 技术栈构建，开箱即用，适合快速部署个人 AI 创作平台或作为二次开发模板。

无论你是设计师、开发者还是 AI 艺术爱好者，Dreamify 都能让你在 10 秒内将创意变为现实。

---

## ✨ 核心特性

| 特性 | 说明 |
|------|------|
| ⚡ **极速生成** | 基于 NVIDIA 4090 GPU 集群，平均 10 秒出图 |
| 🧠 **多模型支持** | 支持 8 种主流 AI 模型，包括 HiDream、Flux、Stable Diffusion、Qwen 等 |
| 🎨 **高质量输出** | 支持最高 1920×1920 分辨率，细节丰富 |
| 🔐 **无需登录** | 完全匿名使用，保护用户隐私 |
| 💬 **智能提示词优化** | 自动将中文提示词转换为英文，提升生成效果 |
| 🖼️ **图生图功能** | 支持单图和多图输入，进行风格迁移与图像编辑 |
| 🎭 **风格转换** | 内置多种艺术风格，一键应用 |
| 📊 **数据统计** | 实时统计生成次数，支持数据库存储 |
| 📦 **零配置部署** | 提供 Docker 镜像与完整部署方案 |
| 🌍 **多语言支持** | 内置中英文界面，支持国际化 |
| 🆓 **100% 免费** | 无使用限制，生成图像可用于个人或商业用途 |

---

## 🖼️ 页面预览
![Dreamify Demo](public/images/dreamifly-demo-1.png)
![Dreamify Demo](public/images/dreamifly-demo-2.png)
![Dreamify Demo](public/images/dreamifly-demo-3.png)

> 所有图像均由 Dreamify 平台 AI 模型生成，用户拥有完整使用权。

---

## 🛠️ 技术架构

### 前端
- **框架**: [Next.js](https://nextjs.org) 15.2.4 (App Router)
- **UI 库**: Tailwind CSS + Headless UI
- **状态管理**: React Hooks + Context
- **图像加载**: `next/image` 自动优化
- **国际化**: next-intl 支持（中/英/繁中）
- **表单处理**: React Hook Form

### 后端
- **ComfyUI API库**: [ComfyUI API](https://github.com/SaladTechnologies/comfyui-api)
- **数据库**: PostgreSQL + Drizzle ORM
- **文件上传**: 本地文件系统存储
- **API 路由**: Next.js API Routes

### 支持的 AI 模型
- **HiDream-full-fp8**（北京智象未来科技，中文优化）
- **Flux-Dev**（Black Forest Lab 开源）
- **Stable-Diffusion-3.5**（Stability AI）
- **Flux-Kontext**（12B 参数图像编辑模型）
- **Flux-Krea**（高质量图像生成）
- **Qwen-Image**（阿里云通义千问，中文支持）
- **Qwen-Image-Edit**（图像编辑专用）
- **Wai-SDXL-V150**（动漫风格特化）

### 部署方式
- 本地开发
- Docker 容器化
- Vercel / Netlify 静态托管（前端）
- 自建 ComfyUI 服务（后端）

---

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/LastLighter/Dreamify.git
cd Dreamify
```

### 2. 安装依赖

```bash
npm install
# 或使用 yarn
yarn install
```

### 3. 配置环境变量

创建 `.env` 文件：

```env
# 数据库配置
DATABASE_URL='postgresql://username:password@localhost:5432/dreamify'

# ComfyUI API 端点（无需设置所有模型， 仅配置需要的模型， 其余环境变量完全不配置， 页面即不会展示相应模型）
HiDream_Fp8_URL='https://your-hidream-api.com'
Flux_Krea_URL='https://your-flux-krea-api.com'
Stable_Diffusion_3_5_URL='https://your-sd35-api.com'
Qwen_Image_URL='https://your-qwen-api.com'
Qwen_Image_Edit_URL='https://your-qwen-edit-api.com'
Kontext_fp8_URL='https://your-kontext-api.com'
Wai_SDXL_V150_URL='https://your-wai-sdxl-api.com'

# LLM API 配置（用于提示词优化）
OPEN_AI_API='https://your-llm-api.com/v1'
MAX_TOKENS=2000

# 应用配置
NEXT_PUBLIC_BASE_URL='http://localhost:3000'
```

> 🔐 **重要提示**：
> - 每个模型需要独立的 ComfyUI API 端点（当然如果算力能支持， 也可以用一个服务）
> - API 地址需支持 CORS 且开放 `/prompt` 接口
> - 至少配置一个模型 URL 即可开始使用
> - LLM API 用于中文提示词优化功能

### 4. 初始化数据库

```bash
# 运行数据库迁移
npx drizzle-kit push
```

### 5. 启动开发服务器

```bash
npm run dev
```

访问：`http://localhost:3000`

---

## 🐋 Docker 部署

### 创建 Dockerfile

在项目根目录创建 `Dockerfile`：

```dockerfile
# 使用官方 Node.js 21 Alpine 镜像
FROM node:21-alpine AS base

# 设置工作目录
WORKDIR /app

# 构建阶段
FROM base AS builder

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
```

### 构建和运行

```bash
# 构建镜像
docker build -t dreamify:latest .

# 运行容器
docker run -d \
  --name dreamify \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://username:password@host:port/database" \
  -e HiDream_Fp8_URL="https://your-api.com" \
  -e Flux_Krea_URL="https://your-api.com" \
  -e NEXT_PUBLIC_BASE_URL="https://your-domain.com" \
  dreamify:latest
```

### Docker Compose 部署（推荐）

创建 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  dreamify:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/dreamify
      - HiDream_Fp8_URL=https://your-hidream-api.com
      - Flux_Krea_URL=https://your-flux-krea-api.com
      - NEXT_PUBLIC_BASE_URL=https://your-domain.com
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=dreamify
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

启动服务：

```bash
docker-compose up -d
```

---

## 📂 项目结构

```bash
Dreamify/
├── src/
│   ├── app/
│   │   ├── [locale]/              # 国际化路由
│   │   │   ├── layout.tsx         # 本地化布局
│   │   │   ├── page.tsx           # 主页
│   │   │   ├── HomeClient.tsx     # 主页客户端组件
│   │   │   └── communityWorks.ts  # 社区作品数据
│   │   ├── api/                   # API 路由
│   │   │   ├── generate/route.ts  # 图像生成 API
│   │   │   ├── models/route.ts    # 模型列表 API
│   │   │   ├── upload/route.ts    # 文件上传 API
│   │   │   ├── optimize-prompt/route.ts # 提示词优化 API
│   │   │   └── stats/route.ts     # 统计数据 API
│   │   ├── layout.tsx             # 根布局
│   │   ├── page.tsx               # 根页面
│   │   └── globals.css            # 全局样式
│   ├── components/                 # 可复用组件
│   │   ├── GenerateForm.tsx       # 生成表单
│   │   ├── GeneratePreview.tsx    # 预览组件
│   │   ├── GenerateSection.tsx    # 生成区域
│   │   ├── PromptInput.tsx        # 提示词输入
│   │   ├── StyleTransferForm.tsx  # 风格转换表单
│   │   ├── TabNavigation.tsx      # 标签导航
│   │   ├── SiteStats.tsx          # 站点统计
│   │   └── ...
│   ├── db/                        # 数据库相关
│   │   ├── index.ts               # 数据库连接
│   │   └── schema.ts              # 数据模型
│   ├── hooks/                     # 自定义 Hooks
│   │   └── useNavWidth.ts         # 导航宽度 Hook
│   ├── utils/                     # 工具函数
│   │   ├── comfyApi.ts            # ComfyUI API 客户端
│   │   ├── modelConfig.ts         # 模型配置
│   │   ├── promptOptimizer.ts     # 提示词优化
│   │   ├── t2iworkflow.ts         # 文生图工作流
│   │   ├── i2iworkflow.ts         # 图生图工作流
│   │   └── locale.ts              # 本地化工具
│   ├── messages/                  # 国际化语言包
│   │   ├── en.json               # 英文
│   │   ├── zh.json               # 中文
│   │   └── zh-TW.json            # 繁体中文
│   ├── config.ts                  # 配置文件
│   └── i18n.ts                   # 国际化配置
├── drizzle/                       # 数据库迁移文件
├── public/                        # 静态资源
├── scripts/                       # 脚本文件
├── .env.example                   # 环境变量示例
├── drizzle.config.json            # Drizzle 配置
├── next.config.js                 # Next.js 配置
├── package.json                   # 项目依赖
└── README.md                      # 项目文档
```

---

## 🔄 API 调用流程

```text
Frontend (Next.js)
    ↓ POST /api/generate
    → 读取环境变量中的模型 URL
    → 根据模型类型选择对应工作流
    → 构造 ComfyUI 标准 Prompt JSON
    → 调用 ComfyUI /prompt 接口
    ← 返回生成图像 Base64 数据
    → 前端展示结果
```

### 支持的参数
- `prompt`: 提示词（支持中文自动优化）
- `negative_prompt`: 负面提示词
- `width`, `height`: 图像尺寸（64-1920px）
- `steps`: 生成步数（5-40）
- `model`: 模型选择
- `images`: 参考图像数组（图生图）
- `denoise`: 去噪强度（0-1）
- `batch_size`: 批量生成数量（1-4）

---

## ❓ 常见问题（FAQ）

### Q: Dreamify 是完全免费的吗？  
A: 是的，Dreamify 提供完全免费的图像生成服务，无任何隐藏收费。

### Q: 生成的图像可以用于商业用途吗？  
A: 可以。用户拥有对生成图像的全部使用权，包括商业用途。

### Q: 是否需要注册账号？  
A: 不需要。Dreamify 支持匿名使用，无需登录。

### Q: 支持哪些 AI 模型？  
A: 当前支持 8 种模型：
- **HiDream-full-fp8**（国产高性能模型，中文优化）
- **Flux-Dev**（Black Forest Lab，支持文生图和图生图）
- **Stable-Diffusion-3.5**（Stability AI）
- **Flux-Kontext**（图像编辑，支持多图输入）
- **Flux-Krea**（高质量图像生成）
- **Qwen-Image**（阿里云通义千问，中文支持）
- **Qwen-Image-Edit**（图像编辑专用）
- **Wai-SDXL-V150**（动漫风格特化）

### Q: 中文提示词支持吗？  
A: 支持！系统会自动检测中文提示词并使用 LLM 服务将其优化为英文，提升生成效果。HiDream 和 Qwen 模型对中文有良好支持。

### Q: 如何配置多个模型？  
A: 在 `.env` 文件中为每个模型配置对应的 API URL。至少配置一个模型即可开始使用，系统会自动检测可用的模型。

### Q: 支持图生图功能吗？  
A: 支持！可以上传 1-2 张参考图像，系统会根据选择的模型自动切换到图生图模式。

---

## 🤝 贡献指南

我们欢迎任何形式的贡献！

- 🐞 **提交 Issue**：报告 Bug 或提出功能建议
- 🌟 **提交 PR**：修复问题、优化 UI、增加新功能
- 📚 **文档改进**：帮助完善 README 或多语言支持
- 🔗 **生态共建**：开发插件、Workflow、模型包

> 项目灵感来源于 [FluxEz](https://flux.comnergy.com/zh)，致敬开源社区！

---

## 📜 许可证

MIT License | © 2025 Dreamify Project

---

## 🌐 在线体验

👉 [立即体验 Dreamify](https://dreamifly.com)

---

## 🧩 合作伙伴

我们与以下优秀 AI 工具平台合作，共同推动 AI 艺术生态发展：

- **[AnyComfy](https://anycomfy.com)**  
  一个免费、无限使用的在线 ComfyUI 平台，轻松运行任意 AI 绘画工作流。

---

💡 **让 AI 绘画变得简单，释放你的无限创意。**  
Built with ❤️ by [LastLight](https://github.com/LastLighter)