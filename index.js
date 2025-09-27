const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

console.log('抖音解析服务启动...');

// 主页
app.get('/', (req, res) => {
  res.send(`
    <h1>抖音解析服务 - 紧急修复版</h1>
    <p>状态: 运行中</p>
    <p>时间: ${new Date().toLocaleString()}</p>
    <h2>可用接口:</h2>
    <ul>
      <li>POST /dy/api/de-url - 主要解析接口</li>
      <li>GET /health - 健康检查</li>
      <li>POST /test - 测试接口</li>
    </ul>
    <p>功能: 提取抖音视频直链</p>
  `);
});

// 健康检查 - 简单版本
app.get('/health', (req, res) => {
  console.log('健康检查请求');
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    service: '抖音解析服务',
    version: '紧急修复版'
  });
});

// 主要解析接口
app.post('/dy/api/de-url', async (req, res) => {
  console.log('收到解析请求:', req.body);
  
  try {
    const share_url = req.body.share_url || req.body.url;
    
    if (!share_url) {
      return res.json({
        code: 1,
        msg: '缺少share_url参数'
      });
    }

    // 调用第三方API
    const response = await axios.post(
      'https://min.taoanlife.com/dy/api/de-url',
      {
        share_url: share_url,
        de_type: 1
      },
      {
        headers: {
          'de-secret-key': 'CB9c3aOfTzFqePMjUARg6JQiLHlNnxut',
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    console.log('第三方API响应:', response.data);

    // 直接返回响应
    if (response.data && response.data.code === 0) {
      // 尝试提取视频链接
      let videoUrl = null;
      const data = response.data.data;
      
      if (data) {
        videoUrl = data.play_url || data.video_url || data.url || data.video;
        console.log('提取到的视频链接:', videoUrl);
      }

      res.json({
        code: 0,
        msg: '解析成功',
        data: {
          ...data,
          play_url: videoUrl,
          direct_video_url: videoUrl
        }
      });
    } else {
      res.json(response.data);
    }

  } catch (error) {
    console.error('解析失败:', error.message);
    res.json({
      code: 1,
      msg: '解析失败: ' + error.message
    });
  }
});

// 测试接口
app.post('/test', async (req, res) => {
  console.log('测试请求:', req.body);
  res.json({
    message: '测试接口正常',
    received: req.body,
    time: new Date().toISOString()
  });
});

// 通配符处理 - 防止404
app.use('*', (req, res) => {
  console.log('未找到路由:', req.method, req.originalUrl);
  res.status(404).json({
    error: 'Not Found',
    method: req.method,
    path: req.originalUrl,
    available_endpoints: [
      'GET /',
      'GET /health', 
      'POST /dy/api/de-url',
      'POST /test'
    ]
  });
});

app.listen(port, () => {
  console.log(`服务运行在端口 ${port}`);
  console.log('可用接口:');
  console.log('- GET / (主页)');
  console.log('- GET /health (健康检查)');
  console.log('- POST /dy/api/de-url (解析接口)');
  console.log('- POST /test (测试接口)');
});
