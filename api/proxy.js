export default async function handler(req, res) {
  // 1. 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', 'https://20ahxa10.github.io');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(204).end();
  }

  // 2. 拼接目标 GitHub API 地址
  const url = new URL(req.url, `https://${req.headers.host}`);
  const path = url.pathname.replace(/^\/api\/proxy/, '');
  const targetUrl = `https://api.github.com${path}${url.search}`;

  // 3. 构造转发请求头
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Vercel-Proxy',
  };
  if (req.headers.authorization) headers.Authorization = req.headers.authorization;
  if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];

  // 4. 发起请求
  try {
    const fetchOptions = {
      method: req.method,
      headers: headers,
    };
    
    // 处理 POST/PUT 的请求体
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      if (typeof req.body === 'object') {
        fetchOptions.body = JSON.stringify(req.body);
      } else {
        fetchOptions.body = req.body;
      }
    }

    const response = await fetch(targetUrl, fetchOptions);
    const data = await response.text();

    // 5. 返回响应并添加 CORS 头
    res.setHeader('Access-Control-Allow-Origin', 'https://20ahxa10.github.io');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept');
    res.status(response.status).send(data);
  } catch (error) {
    res.status(500).json({ error: 'Proxy request failed', details: error.message });
  }
}
