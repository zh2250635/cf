# cf
azure-openai-proxy

感谢 https://github.com/haibbo/cf-openai-azure-proxy

##改变了什么
- 给部署一个默认的名字，和模型名一致
- 支持从url转递资源名
- 触发内容安全重定向
- 支持改变azure的流，使得更像openai

##如何部署
支持的环境变量：
```
ENV OPENAI_BASE_URL=https://api.openai.com/v1
ENV OPENAI_KEY=sk-xxx
ENV SHOULD_USE_OPENAI=1
ENV SHOULD_MAKE_LINE=1
```
都是字面意思

###1.使用cf的worker部署
复制server.js到worker即可
###2.使用docker部署
镜像名```xhtnext/mycf:latest```
