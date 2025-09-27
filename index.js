const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/dy/api/de-url', async (req, res) => {
  try {
    const response = await axios.post(
      'https://min.taoanlife.com/dy/api/de-url',
      req.body,
      {
        headers: {
          'de-secret-key': 'CB9c3aOfTzFqePMjUARg6JQiLHlNnxut',
          'Content-Type': 'application/json'
        }
      }
    );
    res.json(response.data);
  } catch (error) {
    res.json({ code: 1, msg: '解析失败' });
  }
});

app.get('/', (req, res) => {
  res.send('抖音解析服务运行中');
});

app.listen(port, () => {
  console.log('服务启动，端口:', port);
});
