FROM node:18.12-slim

WORKDIR /app

# 安装 Cloudflare Workers CLI 工具
RUN npm install -g wrangler@2.15.0

ENV WRANGLER_SEND_METRICS=false


# 复制 Workers 脚本到镜像
COPY server.js .

# 启动本地开发服务器
CMD wrangler dev server.js --local --var OPENAI_BASE_URL=$OPENAI_BASE_URL  OPENAI_KEY=$OPENAI_KEY