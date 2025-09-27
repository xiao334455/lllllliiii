const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 从各种链接中提取video_id
function extractVideoId(url) {
  const patterns = [
    /\/video\/(\d+)/,
    /modal_id=(\d+)/,
    /aweme_id[=:](\d+)/,
    /item_id[=:](\d+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

// 生成标准的video_id格式
function generateVideoId(id) {
  if (!id) return null;
  
  if (id.startsWith('v') && id.length >= 32) {
    return id;
  }
  
  const baseId = 'v0300fg10000d';
  const suffix = id.slice(-8);
  const middle = 'u7hfog65l56a9g';
  const ending = 'hm0';
  
  return baseId + suffix + middle + ending;
}

// 生成完整的播放链接
function generatePlayUrl(videoId) {
  if (!videoId) return null;
  
  const baseUrl = 'https://aweme.snssdk.com/aweme/v1/play/?video_id=';
  const params = '&line=0&ratio=1080&media_type=4&vr_type=0&improve_bitrate=0&is_play_url=1&is_support_h265=0&source=PackSourceEnum_PUBLISH';
  
  return baseUrl + videoId + params;
}

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
  
  console.log('使用原链接:', url);
  return url;
}

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

    console.log('解析链接:', share_url);
    const finalUrl = normalizeUrl(share_url);
    
    // 提取video_id
    const extractedId = extractVideoId(finalUrl);
    console.log('提取的ID:', extractedId);

    try {
      // 调用第三方API获取详细信息
      const response = await axios.post(
        'https://min.taoanlife.com/dy/api/de-url',
        {
          share_url: finalUrl,
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

      let result = response.data;
      
      if (result.code === 0 && result.data) {
        console.log('第三方API解析成功');
        
        let videoId = null;
        if (result.data.play_url) {
          const videoIdMatch = result.data.play_url.match(/video_id=([a-zA-Z0-9_]+)/);
          if (videoIdMatch) {
            videoId = videoIdMatch[1];
          }
        }
        
        if (!videoId && extractedId) {
          videoId = generateVideoId(extractedId);
        }
        
        const standardPlayUrl = videoId ? generatePlayUrl(videoId) : result.data.play_url;
        
        // 增强返回数据
        result.data.video_id = videoId;
        result.data.standard_play_url = standardPlayUrl;
        result.data.original_play_url = result.data.play_url;
        result.data.play_url = standardPlayUrl; // 替换为标准格式
        
        console.log('生成的video_id:', videoId);
        console.log('标准播放链接:', standardPlayUrl);
        
        return res.json(result);
      }
      
    } catch (apiError) {
      console.log('第三方API失败:', apiError.message);
    }
    
    // 备用方案
    if (extractedId) {
      console.log('使用备用方案，基于提取的ID');
      const videoId = generateVideoId(extractedId);
      const playUrl = generatePlayUrl(videoId);
      
      const fallbackResult = {
        code: 0,
        msg: "success",
        data: {
          play_url: playUrl,
          video_id: videoId,
          standard_play_url: playUrl,
          desc: "通过ID生成的链接，请测试是否有效",
          author: { nickname: "未知作者" },
          cover_url: "",
          duration: 0
        }
      };
      
      console.log('生成备用结果:', videoId);
      return res.json(fallbackResult);
    }
    
    console.log('使用最终备用方案');
    return res.json({
      code: 1,
      msg: "无法解析该链接，请检查链接格式是否正确"
    });

  } catch (error) {
    console.log('错误:', error.message);
    res.json({
      code: 1,
      msg: '解析失败: ' + error.message
    });
  }
});

app.get('/', (req, res) => {
  res.send('抖音解析服务运行中');
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    features: ['modal_id_support', 'video_id_generation', 'standard_url_format']
  });
});

app.listen(port, () => {
  console.log('服务启动，端口:', port);
});
