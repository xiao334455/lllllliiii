const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

console.log('抖音解析服务启动 - 基于插件逻辑优化');

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

// 验证video_id格式（基于插件逻辑）
function isValidVideoId(videoId) {
  if (!videoId || typeof videoId !== 'string') return false;
  
  // 插件中使用的正则: /^v[a-zA-Z0-9_]{30,40}$/
  // 但也支持其他格式的video_id
  return (/^v[a-zA-Z0-9_]{30,40}$/.test(videoId) && videoId.length >= 32 && videoId.length <= 40) ||
         (/^[a-zA-Z0-9_]{20,40}$/.test(videoId) && videoId.length >= 20);
}

// 标准化video_id（基于插件逻辑）
function normalizeVideoId(videoId) {
  if (!videoId) return null;
  
  // 移除可能的前缀
  videoId = videoId.replace(/^.*video_id[=:]/, '');
  
  // 移除可能的后缀参数
  videoId = videoId.split('&')[0].split('?')[0];
  
  // 确保长度正确
  if (videoId.length > 40) {
    videoId = videoId.substring(0, 34);
  }
  
  return isValidVideoId(videoId) ? videoId : null;
}

// 从API响应中递归搜索video_id（基于插件逻辑）
function findVideoIdsInObject(obj, depth = 0) {
  if (depth > 5) return []; // 限制递归深度
  
  const videoIds = [];
  
  if (typeof obj === 'object' && obj !== null) {
    for (const key in obj) {
      // 检查key名称是否包含video_id相关字段
      if (key.toLowerCase().includes('video_id') || 
          key.toLowerCase().includes('vid') || 
          key.toLowerCase().includes('aweme_id') ||
          key === 'id') {
        const value = obj[key];
        if (typeof value === 'string') {
          const normalizedId = normalizeVideoId(value);
          if (normalizedId) {
            console.log(`找到video_id (${key}):`, normalizedId);
            videoIds.push(normalizedId);
          }
        }
      } else if (typeof obj[key] === 'object') {
        videoIds.push(...findVideoIdsInObject(obj[key], depth + 1));
      }
    }
  }
  
  return [...new Set(videoIds)]; // 去重
}

// 生成下载链接（基于插件逻辑）
function generateDownloadUrl(videoId) {
  if (!videoId) return null;
  
  // 使用插件中的URL模式
  const baseUrl = 'https://aweme.snssdk.com/aweme/v1/play/?video_id=';
  const params = '&line=0&ratio=1080&media_type=4&vr_type=0&improve_bitrate=0&is_play_url=1&is_support_h265=0&source=PackSourceEnum_PUBLISH';
  
  return baseUrl + videoId + params;
}

// 提取视频播放链接（综合策略）
function extractVideoUrl(apiResponse) {
  if (!apiResponse || !apiResponse.data) {
    return null;
  }
  
  const data = apiResponse.data;
  console.log('开始提取视频链接，数据结构:', JSON.stringify(data, null, 2));
  
  // 策略1: 直接从API响应获取播放链接
  const directUrlFields = [
    'play_url',
    'video_url', 
    'url',
    'video',
    'play_addr',
    'download_url',
    'video_play_addr'
  ];
  
  for (const field of directUrlFields) {
    if (data[field]) {
      let url = data[field];
      if (typeof url === 'object') {
        url = url.url || url.play_url || url.uri;
      }
      if (url && typeof url === 'string' && url.startsWith('http')) {
        console.log(`找到直接播放链接 (${field}):`, url);
        return {
          type: 'direct',
          url: url,
          source: field
        };
      }
    }
  }
  
  // 策略2: 提取video_id并生成aweme链接
  const videoIds = findVideoIdsInObject(data);
  if (videoIds.length > 0) {
    const videoId = videoIds[0]; // 使用第一个找到的video_id
    const generatedUrl = generateDownloadUrl(videoId);
    console.log(`通过video_id生成aweme链接:`, generatedUrl);
    return {
      type: 'generated',
      url: generatedUrl,
      source: 'video_id',
      video_id: videoId
    };
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
        timeout: 20000
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
    console.log('收到解析请求:', req.body);
    
    const share_url = req.body.share_url || req.body.url;
    
    if (!share_url) {
      return res.json({
        code: 1,
        msg: '缺少share_url参数'
      });
    }

    const normalizedUrl = normalizeUrl(share_url);
    const apiResult = await parseDouyinVideo(normalizedUrl);
    
    if (apiResult.code === 0) {
      // 提取视频链接
      const videoResult = extractVideoUrl(apiResult);
      
      if (videoResult) {
        console.log(`成功提取视频链接 (${videoResult.type}):`, videoResult.url);
        
        // 返回包含直链的数据
        const responseData = {
          ...apiResult,
          data: {
            ...apiResult.data,
            play_url: videoResult.url,
            direct_video_url: videoResult.url,
            video_type: videoResult.url.includes('toutiaovod.com') ? 'toutiaovod' : 
                       videoResult.url.includes('aweme.snssdk.com') ? 'aweme' : 'other',
            extraction_method: videoResult.type,
            extraction_source: videoResult.source,
            video_id: videoResult.video_id || null
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
  console.log('健康检查请求');
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    service: '抖音解析服务 - 插件逻辑优化版',
    features: [
      '支持toutiaovod直链提取',
      '支持video_id提取和aweme链接生成',
      '递归搜索video_id',
      'video_id格式验证'
    ]
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
    const videoResult = extractVideoUrl(apiResult);
    
    res.json({
      normalized_url: normalizedUrl,
      api_result: apiResult,
      video_extraction_result: videoResult,
      video_ids_found: findVideoIdsInObject(apiResult.data || {}),
      test_time: new Date().toISOString()
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
    <h1>抖音解析服务 - 插件逻辑优化版</h1>
    <p>状态: 运行中</p>
    <p>时间: ${new Date().toLocaleString()}</p>
    <h2>可用接口:</h2>
    <ul>
      <li>POST /dy/api/de-url - 主要解析接口</li>
      <li>GET /health - 健康检查</li>
      <li>POST /test - 测试接口</li>
    </ul>
    <h2>新功能:</h2>
    <ul>
      <li>基于插件逻辑的video_id提取</li>
      <li>支持aweme.snssdk.com链接生成</li>
      <li>递归搜索嵌套对象中的video_id</li>
      <li>video_id格式验证</li>
    </ul>
  `);
});

// 启动服务
app.listen(port, () => {
  console.log(`服务运行在端口 ${port}`);
  console.log('基于插件逻辑优化，支持多种视频链接提取策略');
});
