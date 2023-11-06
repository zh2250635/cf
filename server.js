// The name of your Azure OpenAI Resource.
// const resourceName=RESOURCE_NAME
const openaiGpt4 = OPENAI_GPT4
const openaiKey4 = OPENAI_KEY4
const openaiGpt35Turbo = OPENAI_GPT35_TURBO
const openaiKey35Turbo = OPENAI_KEY35_TURBO
const shouldUseOpenAI = Boolean(parseInt(SHOULD_USE_OPENAI, 10));
const shouldMakeLine = Boolean(parseInt(SHOULD_MAKE_LINE, 10));
const webhookKey = WEBHOOK_KEY

console.log("should make line ? ", SHOULD_USE_OPENAI, shouldMakeLine, "should use op ? ",SHOULD_MAKE_LINE, shouldUseOpenAI)

// The deployment name you chose when you deployed the model.
const mapper = {
  "gpt-3.5-turbo":"gpt-35-turbo",
  "gpt-3.5-turbo-0613": "gpt-35-turbo",
  "gpt-3.5-turbo-0301": "gpt-35-turbo",
  "gpt-3.5-turbo-16k":"gpt-35-turbo-16k",
  "gpt-3.5-turbo-16k-0613": "gpt-35-turbo-16k",
  "gpt-4":"gpt-4",
  "gpt-4-0613": "gpt-4",
  "gpt-4-0314": "gpt-4",
  "gpt-4-32k":"gpt-4-32k",
  "gpt-4-32k-0613": "gpt-4-32k",
  "gpt-4-32k-0314": "gpt-4-32k",
  "text-embedding-ada-002": "text-embedding-ada-002"
};

const apiVersion="2023-07-01-preview"

addEventListener("fetch", (event) => {
  event.respondWith(
    handleRequest(event.request).catch((err) => {
      console.log('全局捕获的错误：', err, "\n-------------------\n");
      return new Response('Internal Server Error', { status: 500 });
    })
  );
});

async function handleRequest(request) {
  try {
    const url = new URL(request.url);

    // 动态获取RESOURCE_NAME
    const pathSegments = url.pathname.split("/");
    const resourceName = pathSegments[1];

    // 移除RESOURCE_NAME，得到新的pathname
    const newPathname = '/' + pathSegments.slice(2).join('/');
    url.pathname = newPathname;

    let path;
    switch (url.pathname) {
      case '/v1/chat/completions':
        path = "chat/completions";
        break;
      case '/v1/completions':
        path = "completions";
        break;
      case '/v1/models':
        return handleModels(request);
      case '/v1/embeddings':
      case '/v1/engines/text-embedding-ada-002/embeddings':
        path = "embeddings";
        break;
      case '/v1/whisper/transcribe':
        return handleWhisperTranscribe(request);
      default:
        return new Response('404 Not Found', { status: 404 });
    }

    let body;
    if (request.method === 'POST') {
      body = await request.json();
    }

    const modelName = body?.model;  
    const deployName = mapper[modelName] || '' 

    if (deployName === '') {
      return new Response('Missing model mapper', {
          status: 403
      });
    }

    //gateway: https://gateway.ai.cloudflare.com/v1/96188266054b9973baec8a9b5212141c/test/azure-openai/az-beta-2-s1-canada-east/gpt-4-32k/chat/completions?api-version=2023-07-01-previewa
    const fetchAPI = `https://${resourceName}.openai.azure.com/openai/deployments/${deployName}/${path}?api-version=${apiVersion}`
    // const fetchAPI = `https://gateway.ai.cloudflare.com/v1/96188266054b9973baec8a9b5212141c/test/azure-openai/${resourceName}/${deployName}/${path}?api-version=${apiVersion}`

    const authKey = request.headers.get('Authorization');
    if (!authKey) {
      return new Response("Not allowed", {
        status: 403
      });
    }

    const payload = {
      method: request.method,
      headers: {
        "Content-Type": "application/json",
        "api-key": authKey.replace('Bearer ', ''),
      },
      body: typeof body === 'object' ? JSON.stringify(body) : '{}',
    };

      let response = await fetch(fetchAPI, payload);

      const fetchFromOpenAI = async (payload, path) => {
        let openaiBaseUrl = openaiGpt35Turbo; // 默认使用 GPT-3.5 的 baseURL
        let openaiKey = openaiKey35Turbo;     // 默认使用 GPT-3.5 的 API key
      
        if (modelName.startsWith('gpt-4')) {
          openaiBaseUrl = openaiGpt4;
          openaiKey = openaiKey4;
        }
      
        const url = `${openaiBaseUrl}/v1/${path}`;
      
        payload.headers = payload.headers || {};
        payload.headers['Authorization'] = `Bearer ${openaiKey}`;
      
        try {
          return await fetch(url, payload);
        } catch (error) {
          console.error('Fetch to OpenAI failed:', error);
          // Handle error appropriately
        }
      };
      if (shouldUseOpenAI) {
        try {
          if (response.status === 400) {
            let data = await response.json();
            switch (data?.error?.code) {
              case 'content_filter':
                console.log('content_filter catched 😅');
                response = await fetchFromOpenAI(payload, path);
                break;
              case 'context_length_exceeded':
                console.log('max_length, message: ', data?.error?.message);
                const errorMsg = {
                  "error": {
                    "message": data?.error?.message || "Context length exceeded",
                    "type": "invalid_request_error",
                    "param": "messages",
                    "code": "context_length_exceeded"
                  }
                };
                return new Response(JSON.stringify(errorMsg), {
                  status: 400,
                  headers: {
                    'Content-Type': 'application/json'
                  }
                });
                break;
              default:
                console.log('Unhandled error code in 400 😓');
            }
          } else if (response.status === 429) {
            console.log(`${resourceName}, meet rate limit, switching to OpenAI 😓`);
            handelWebHook(`${resourceName}, meet rate limit, switching to OpenAI 😓`)
            response = await fetchFromOpenAI(payload, path);
          } else if (response.status === 307) {
            try {
              let json = await response.json();
              console.log(`We got a 307 in ${resourceName}, what's up? 🤔`, json);
              handelWebHook(`We got a 307, what's up? 🤔 ${json}`)
            } catch (e) {
              console.log("Got a 307, but no JSON in the response 😱");
            } finally {
              response = await fetchFromOpenAI(payload, path);
            }
          }else if(response.status !== 200){
            console.log("response status: ", response.status)
            handelWebHook(`got a ${response.status} in ${resourceName}, please check!`)
            response = await fetchFromOpenAI(payload, path);
          }
        } catch (error) {
          console.log("An unexpected error occurred 😵", error);
        }
      }
      
      response = new Response(response.body, response);
      response.headers.set("Access-Control-Allow-Origin", "*");

      if (body?.stream != true){
        return response
      } 

      let { readable, writable } = new TransformStream()
      stream(response.body, writable, body?.model);
      return new Response(readable, response);
  }catch (error) {
    throw error; // 重新抛出错误，让全局捕获器捕获
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function make_line(line) {
  if (line === 'data: [DONE]') {
      return 'data: [DONE]\n\n';
  } else if (line.startsWith('data: ')) {
      const jsonPart = line.slice(6);
      let jsonData;
      try {
          jsonData = JSON.parse(jsonPart);
      } catch (error) {
          console.error('Error parsing JSON:', error);
          return null;
      }

      // 确保jsonData["choices"]存在
      if (!jsonData["choices"] || !Array.isArray(jsonData["choices"]) || jsonData["choices"].length === 0) {
          return null;
      }

      try {
          const returnChoices = jsonData["choices"];
          if (returnChoices && returnChoices[0]) {
              delete returnChoices[0]["content_filter_results"];
              // if ('role' in returnChoices[0]['delta']) {
              //     returnChoices[0]['delta']['content'] = '';
              // }
          }

          const returnJson = JSON.stringify({
              "id": jsonData["id"],
              "object": jsonData["object"],
              "created": jsonData["created"],
              "model": jsonData["model"] ? jsonData["model"] : "gpt-4",
              "choices": jsonData["choices"]
          });
          return 'data: ' + returnJson + '\n\n';
      } catch (error) {
          console.error('Error processing data:', error);
          return null;
      }
  }
  return null;
}

// support printer mode and add newline
async function stream(readable, writable, model) {
  try {

    const reader = readable.getReader();
    const writer = writable.getWriter();

    // const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
  // let decodedValue = decoder.decode(value);
    const newline = "\n";
    const delimiter = "\n\n"
    const encodedNewline = encoder.encode(newline);

    let buffer = "";
    while (true) {
      let { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true }); // stream: true is important here,fix the bug of incomplete line
      let lines = buffer.split(delimiter);

      // Loop through all but the last line, which may be incomplete.
      for (let i = 0; i < lines.length - 1; i++) {
          if(shouldMakeLine) {

            let processedLine = make_line(lines[i]);

            if (processedLine) { // 如果make_line返回null，我们就不处理这一行
                await writer.write(encoder.encode(processedLine));
            }
          }else {
            await writer.write(encoder.encode(lines[i] + delimiter));
          }
        if (model.startsWith('gpt-3.5')) {
          await sleep(20);
        }else if (model.startsWith('gpt-4')) {
          await sleep(30);
        }
      }

      buffer = lines[lines.length - 1];
    }

    if (buffer && shouldMakeLine) {
      let processedLine = make_line(buffer);
      if (processedLine) {
          await writer.write(encoder.encode(processedLine));
      }
    }else if (buffer) {
      await writer.write(encoder.encode(buffer));
    }
    await writer.write(encodedNewline)
    await writer.close();
  }catch (error) {
    throw error; // 重新抛出错误，让全局捕获器捕获
  }
}

async function handleModels(request) {
  const data = {
    "object": "list",
    "data": []  
  };

  for (let key in mapper) {
    data.data.push({
      "id": key,
      "object": "model",
      "created": 1677610602,
      "owned_by": "openai",
      "permission": [{
        "id": "modelperm-M56FXnG1AsIr3SXq8BYPvXJA",
        "object": "model_permission",
        "created": 1679602088,
        "allow_create_engine": false,
        "allow_sampling": true,
        "allow_logprobs": true,
        "allow_search_indices": false,
        "allow_view": true,
        "allow_fine_tuning": false,
        "organization": "*",
        "group": null,
        "is_blocking": false
      }],
      "root": key,
      "parent": null
    });  
  }

  const json = JSON.stringify(data, null, 2);
  return new Response(json, {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleOPTIONS(request) {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': '*',
        'Access-Control-Allow-Headers': '*'
      }
    })
}

async function handleWhisperTranscribe(request) {
  try {
    const fetchAPI = `https://${resourceName}.openai.azure.com/openai/deployments/whisper/audio/transcriptions?api-version=${apiVersion}`;
    const authKey = request.headers.get('Authorization');

    if (!authKey || !authKey.startsWith('Bearer ')) {
      return new Response("未授权或授权格式错误", {
        status: 403
      });
    }

    // 创建一个新的Headers对象，并复制所有原始请求的头
    const headers = new Headers(request.headers);
    headers.set("api-key", authKey.replace('Bearer ', ''));
    headers.delete('Authorization');  // 删除Authorization头

    const payload = {
      method: request.method,
      headers: headers,
      body: request.body  // 直接转发流
    };

    const response = await fetch(fetchAPI, payload);

    if (!response.ok) {
      return new Response(`API调用失败: ${response.statusText}`, {
        status: response.status
      });
    }

    return new Response(response.body, {
      status: response.status,
      headers: response.headers  // 复制原始响应的headers
    });

  } catch (error) {
    return new Response(`发生错误: ${error.toString()}`, {
      status: 500
    });
  }
}

async function handelWebHook(text){
  const fetchAPI = `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${webhookKey}`;
  const payload = {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      "msgtype": "text",
      "text": {
        "content": text
      }
    })
  };
  try{
    const response = await fetch(fetchAPI, payload);
    return response
  }catch(error){
    console.log("send webhook error: ", error)
    return null
  }
}