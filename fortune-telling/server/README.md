# 周易六爻占卜 - 后端服务

## 项目目录结构说明

本项目的 `.env` 文件统一放在仓库根目录的 `server/` 下，与前端代码分离：

```
fortune-telling/          ← Git 仓库根目录
├── server/
│   └── .env              ← 环境变量（API Key 等），此处配置，不提交 Git
└── fortune-telling/      ← 前端 + 后端代码
    ├── server/
    │   ├── index.js      # 后端服务主文件（读取上级 ../server/.env）
    │   ├── package.json
    │   └── README.md
    ├── js/
    │   ├── coin.js       # 铜钱动画模块
    │   ├── api.js        # API 通信模块
    │   ├── renderer.js   # 渲染模块
    │   └── png-export.js # 截图导出模块（保存长图 PNG）
    ├── netlify/
    │   └── functions/    # Netlify 部署用的 Serverless 函数
    ├── assets/
    │   └── coins/        # 铜钱 SVG 素材
    ├── index.html        # 前端页面
    ├── styles.css        # 样式文件
    └── script.js         # 前端主程序
```

## 快速开始（本地开发）

### 1. 安装依赖

```bash
cd fortune-telling/server
npm install
```

### 2. 配置环境变量

编辑仓库根目录下的 `server/.env`（不是 `fortune-telling/server/.env`）：

```env
# API 配置
API_KEY=你的OpenRouter密钥（格式：sk-or-v1-...）
API_BASE=https://openrouter.ai/api/v1
MODEL_NAME=stepfun/step-3.5-flash:free

# 服务器配置
PORT=3000
```

> OpenRouter API Key 获取地址：https://openrouter.ai/keys

### 3. 启动服务

**方式一：PowerShell（推荐 Windows）**

```powershell
cd fortune-telling/server
# 加载上级 .env 并启动
Get-Content "../../server/.env" | ForEach-Object {
    if ($_ -notmatch '^\s*#' -and $_ -notmatch '^\s*$') {
        $parts = $_ -split '=', 2
        [System.Environment]::SetEnvironmentVariable($parts[0], $parts[1], 'Process')
    }
}
npm start
```

**方式二：Git Bash / Linux / macOS**

```bash
cd fortune-telling/server
export $(grep -v '^#' ../../server/.env | xargs)
npm start
```

服务启动后，访问 http://localhost:3000 即可使用。

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
