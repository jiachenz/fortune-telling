# 周易六爻占卜 - 后端服务

## 快速开始

### 1. 安装依赖

```bash
cd server
npm install
```

### 2. 配置环境变量

编辑 `.env` 文件，配置你的 API Key：

```env
# API 配置
API_KEY=你的API密钥
API_BASE=https://api.siliconflow.cn/v1
MODEL_NAME=Pro/zai-org/GLM-4.7

# 服务器配置
PORT=3000
```

### 3. 启动服务

```bash
npm start
```

服务启动后，访问 http://localhost:3000 即可使用。

## 项目结构

```
fortune-telling/
├── server/
│   ├── index.js      # 后端服务主文件
│   ├── package.json  # 依赖配置
│   ├── .env          # 环境变量（API Key 等）
│   └── README.md     # 说明文档
├── js/
│   ├── coin.js       # 铜钱动画模块
│   ├── api.js        # API 通信模块
│   ├── renderer.js   # 渲染模块
│   └── pdf-export.js # PDF 导出模块
├── assets/
│   └── coins/        # 铜钱素材
├── index.html        # 前端页面
├── styles.css        # 样式文件
└── script.js         # 前端主程序
```

## API 接口

### 健康检查

```
GET /api/health
```

响应：
```json
{
  "status": "ok",
  "message": "周易六爻占卜服务运行中",
  "hasApiKey": true
}
```

### 获取配置

```
GET /api/config
```

响应：
```json
{
  "model": "Pro/zai-org/GLM-4.7",
  "hasApiKey": true
}
```

### 解卦接口

```
POST /api/interpret
Content-Type: application/json

{
  "hexagramData": { ... },
  "userQuestion": "问题内容",
  "yaoResults": [ ... ]
}
```

响应：
```json
{
  "success": true,
  "content": "解卦内容（Markdown 格式）"
}
```

## 部署建议

### 部署到 Vercel

1. 在项目根目录创建 `vercel.json`：
```json
{
  "builds": [
    { "src": "server/index.js", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "server/index.js" },
    { "src": "/(.*)", "dest": "/$1" }
  ]
}
```

2. 在 Vercel 控制台设置环境变量

### 部署到其他平台

- **Railway**: 直接连接 GitHub 仓库
- **Render**: 选择 Node.js 环境
- **阿里云/腾讯云**: 使用云函数或轻量服务器

## 注意事项

1. **不要**将 `.env` 文件提交到 Git 仓库
2. 生产环境请使用 HTTPS
3. 建议添加请求频率限制
