// The name of your Azure OpenAI Resource.
// const resourceName=RESOURCE_NAME
const openaiBaseUrl = OPENAI_BASE_URL || 'https://api.openai.com';
const openaiKey = OPENAI_KEY || '';

// The deployment name you chose when you deployed the model.
const mapper = {
    'gpt-3.5-turbo': "gpt-35-turbo",
    'gpt-3.5-turbo-16k': "gpt-35-turbo-16k",
    'gpt-4': "gpt-4",
    'gpt-4-32k': "gpt-4-32k",
    "text-embedding-ada-002": "text-embedding-ada-002",
};

const apiVersion="2023-07-01-preview"

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);

  // 动态获取RESOURCE_NAME
  const pathSegments = url.pathname.split("/");
  const resourceName = pathSegments[1];

  // 移除RESOURCE_NAME，得到新的pathname
  const newPathname = '/' + pathSegments.slice(2).join('/');
  url.pathname = newPathname;

  let path;
  if (url.pathname === '/v1/chat/completions') {
    path = "chat/completions";
  } else if (url.pathname === '/v1/completions') {
    path = "completions";
  } else if (url.pathname === '/v1/models') {
    return handleModels(request);
  } else if (url.pathname === '/v1/embeddings' || url.pathname === '/v1/engines/text-embedding-ada-002/embeddings') {
    path = "embeddings";
  }else {
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
  const fetchAPI = `https://${resourceName}.openai.azure.com/openai/deployments/${deployName}/${path}?api-version=${apiVersion}`

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

    if (response.status === 400) {
      let data = await response.json();
      if (data?.error?.code === 'content_filter') {
        let opAPI = openaiBaseUrl + '/' + path;
        payload.headers['Authorization'] = `Bearer ${openaiKey}`;
        response = await fetch(opAPI, payload);
        response = new Response(response.body, response);
        response.headers.set("Access-Control-Allow-Origin", "*");
    
        if (body?.stream != true){
          return response
        } 
    
        let { readable, writable } = new TransformStream()
        stream(response.body, writable, body?.model);
        return new Response(readable, response);
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
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// support printer mode and add newline
async function stream(readable, writable, model) {
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
      await writer.write(encoder.encode(lines[i] + delimiter));
      if (model.startsWith('gpt-3.5')) {
        await sleep(20);
      }else if (model.startsWith('gpt-4')) {
        await sleep(30);
      }
    }

    buffer = lines[lines.length - 1];
  }

  if (buffer) {
    await writer.write(encoder.encode(buffer));
  }
  await writer.write(encodedNewline)
  await writer.close();
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

