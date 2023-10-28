# Azure-OpenAI-Proxy 🌐

基于 [haibbo](https://github.com/haibbo) 的 [cf-openai-azure-proxy](https://github.com/haibbo/cf-openai-azure-proxy) 修改而来。

## 特点与改进 🌟

- 默认的部署名与模型名一致，简化配置 🛠️
- 支持从 URL 转递资源名，提高灵活性 🌈
- 添加内容安全重定向功能，增加安全性 🛡️
- 支持改变 Azure 的流程，使其更像 OpenAI 🤖

## 环境变量配置 🛠️

你需要设置以下环境变量：

```shell
ENV OPENAI_BASE_URL=https://api.openai.com/v1
ENV OPENAI_KEY=sk-xxx
ENV SHOULD_USE_OPENAI=1
ENV SHOULD_MAKE_LINE=1
```

- `OPENAI_BASE_URL`: OpenAI API 的基础 URL
- `OPENAI_KEY`: 你的 OpenAI API 密钥
- `SHOULD_USE_OPENAI`: 是否使用 OpenAI（1 表示使用）
- `SHOULD_MAKE_LINE`: 是否修改 Azure 的格式以符合 OpenAI 的格式（1 表示修改）

## 部署方法 🚀

### 使用 Cloudflare Worker 部署

1. 打开 Cloudflare Worker 的控制台。
2. 创建一个新的 Worker。
3. 复制 `server.js` 的代码到 Worker 中。
4. 在 Worker 设置里添加环境变量。

```shell
# 填写环境变量
cf worker env set OPENAI_BASE_URL https://api.openai.com/v1
cf worker env set OPENAI_KEY your_key_here
cf worker env set SHOULD_USE_OPENAI 1
cf worker env set SHOULD_MAKE_LINE 1
```

### 使用 Docker 部署 🐳

1. 从 Docker Hub 获取镜像。

```shell
docker pull xhtnext/mycf:latest
```

2. 配置环境变量并运行容器。

```shell
docker run -e OPENAI_BASE_URL=https://api.openai.com/v1 -e OPENAI_KEY=your_key_here -e SHOULD_USE_OPENAI=1 -e SHOULD_MAKE_LINE=1 xhtnext/mycf:latest
```

这样，你的代理就部署好了！🎉


ps：文档由gpt-4创作
