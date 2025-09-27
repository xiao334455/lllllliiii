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
  
  // 移除末尾的标点符号
  url = url.replace(/[!"'！。.,，、？?；;：:\]\[]+$/, '');
  
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
    const match = url.match(/https?:\/\/www\.douyin\.com\/video\/\d+/);
    if (match) {
      console.log('直接链接:', match[0]);
      return match[0];
    }
  }
  
  console.log('使用原链接:', url);
  return url;
}

// 提取视频播放链接
function extractVideoUrl(apiResponse) {
  if (!apiResponse || !apiResponse.data) {
    return null;
  }
  
  const data = apiResponse.data;
  console.log('尝试提取视频链接，数据结构:', JSON.stringify(data, null, 2));
  
  // 尝试多种可能的字段名
  const possibleFields = [
    'play_url',
    'video_url', 
    'url',
    'video',
    'play_addr',
    'download_url',
    'video_play_addr'
  ];
  
  for (const field of possibleFields) {
    if (data[field]) {
      let url = data[field];
      if (typeof url === 'object') {
        url = url.url || url.play_url || url.uri;
      }
      if (url && typeof url === 'string' && url.startsWith('http')) {
        console.log(`找到视频链接 (${field}):`, url);
        return url;
      }
    }
  }
  
  console.log('未找到视频链接');
  return null;
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

    console.log('API响应状态:', response.status);
    console.log('API响应数据:', JSON.stringify(response.data, null, 2));
    
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
    const apiResult = await parseDouyinVideo(normalizedUrl);
    
    if (apiResult.code === 0) {
      // 提取视频直链
      const videoUrl = extractVideoUrl(apiResult);
      
      if (videoUrl) {
        console.log('成功提取视频链接:', videoUrl);
        
        // 返回包含直链的数据
        const responseData = {
          ...apiResult,
          data: {
            ...apiResult.data,
            play_url: videoUrl,
            direct_video_url: videoUrl,
            video_type: videoUrl.includes('toutiaovod.com') ? 'toutiaovod' : 'other'
          }
        };
        
        res.json(responseData);
      } else {
        console.log('未能提取到视频链接');
        res.json({
          code: 1,
          msg: '未能提取到视频播放链接',
          debug_data: apiResult.data
        });
      }
    } else {
      console.log('API返回错误:', apiResult.msg);
      res.json(apiResult);
    }

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

// 测试接口
app.post('/test', async (req, res) => {
  try {
    const share_url = req.body.share_url || req.body.url;
    
    if (!share_url) {
      return res.json({
        error: '请提供share_url参数'
      });
    }

    const normalizedUrl = normalizeUrl(share_url);
    const apiResult = await parseDouyinVideo(normalizedUrl);
    
    res.json({
      normalized_url: normalizedUrl,
      api_result: apiResult,
      extracted_video_url: extractVideoUrl(apiResult)
    });

  } catch (error) {
    res.json({
      error: error.message
    });
  }
});

// 主页
app.get('/', (req, res) => {
  res.send(`
    <h1>抖音解析服务 - 优化版</h1>
    <p>状态: 运行中</p>
    <p>时间: ${new Date().toLocaleString()}</p>
    <p>API: POST /dy/api/de-url</p>
    <p>测试: POST /test</p>
    <p>健康检查: GET /health</p>
    <p>功能: 提取 toutiaovod.com 格式的视频直链</p>
  `);
});

// 启动服务
app.listen(port, () => {
  console.log(`服务启动成功，端口: ${port}`);
});
