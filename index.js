const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

console.log('启动抖音解析服务...');

// 处理链接格式
function normalizeUrl(url) {
  if (!url) return url;
  
  console.log('原始链接:', url);
  
  // 支持modal_id格式
  if (url.includes('modal_id=')) {
    const match = url.match(/modal_id=(\d+)/);
    if (match) {
      const result = `https://www.douyin.com/video/${match[1]}`;
      console.log('Modal ID转换:', result);
      return result;
    }
  }
  
  // 支持短链接
  if (url.includes('v.douyin.com')) {
    const match = url.match(/https?:\/\/v\.douyin\.com\/[^\s]+/);
    if (match) {
      console.log('短链接:', match[0]);
      return match[0];
    }
  }
  
  // 支持直接链接
  if (url.includes('www.douyin.com/video/')) {
    console.log('直接链接:', url);
    return url;
  }
  
  console.log('使用原链接:', url);
  return url;
}

// 解析抖音视频
async function parseDouyinVideo(normalizedUrl) {
  console.log('开始解析:', normalizedUrl);
  
  try {
    const response = await axios.post(
      'https://min.taoanlife.com/dy/api/de-url',
      {
        share_url: normalizedUrl,
        de_type: 1
      },
      {
        headers: {
          'de-secret-key': 'CB9c3aOfTzFqePMjUARg6JQiLHlNnxut',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 15000
      }
    );

    console.log('API响应:', response.data);
    return response.data;

  } catch (error) {
    console.log('解析失败:', error.message);
    throw error;
  }
}

// 主要API接口
app.post('/dy/api/de-url', async (req, res) => {
  try {
    console.log('收到请求:', req.body);
    
    const share_url = req.body.share_url || req.body.url;
    
    if (!share_url) {
      return res.json({
        code: 1,
        msg: '请提供share_url参数'
      });
    }

    const normalizedUrl = normalizeUrl(share_url);
    const result = await parseDouyinVideo(normalizedUrl);
    
    console.log('返回结果:', result.code === 0 ? '成功' : '失败');
    res.json(result);

  } catch (error) {
    console.log('处理错误:', error.message);
    res.json({
      code: 1,
      msg: '解析失败: ' + error.message
    });
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    service: '抖音解析服务'
  });
});

// 主页
app.get('/', (req, res) => {
  res.send(`
    <h1>抖音解析服务</h1>
    <p>状态: 运行中</p>
    <p>时间: ${new Date().toLocaleString()}</p>
    <p>API: POST /dy/api/de-url</p>
  `);
});

// 启动服务
app.listen(port, () => {
  console.log(`服务启动成功，端口: ${port}`);
});
