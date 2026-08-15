/**
 * 周易六爻占卜 - 后端代理服务
 * ==============================
 * 用于代理 AI API 请求，隐藏 API Key
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 静态文件服务 - 提供前端页面
app.use(express.static(path.join(__dirname, '..')));

// ==========================================
// 本地开发用：计数 / 埋点（线上由 Netlify Functions + Blobs 承担）
// 用一个本地 JSON 文件持久化，方便 `node index.js` 本地联调
// ==========================================
const LOCAL_DATA_FILE = path.join(__dirname, '.local-data.json');

function readLocalData() {
    try {
        return JSON.parse(fs.readFileSync(LOCAL_DATA_FILE, 'utf-8'));
    } catch (e) {
        return { counters: {}, analytics: {} };
    }
}

function writeLocalData(data) {
    try {
        fs.writeFileSync(LOCAL_DATA_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('写入本地数据失败:', e.message);
    }
}

function shanghaiDate() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());
}

// 求卦计数（本地版）：今日第 X 位 + 本设备第 Y 次
app.all('/api/counter', (req, res) => {
    const data = readLocalData();
    const dayKey = `divinations:${shanghaiDate()}`;
    data.counters = data.counters || {};
    const { recordDivination, dayCount } = require('../netlify/lib/divination-counter');

    let rank = null;
    let times = null;
    let rawDay = data.counters[dayKey];

    if (req.method === 'POST') {
        const deviceId = (req.body && req.body.deviceId) || null;
        const result = recordDivination(rawDay, deviceId);
        rawDay = result.day;
        rank = result.rank;
        times = result.times;
        data.counters[dayKey] = rawDay;
        const totalRaw = data.counters['divinations:total'];
        const totalCount = (typeof totalRaw === 'number' ? totalRaw : (totalRaw && totalRaw.count) || 0) + 1;
        data.counters['divinations:total'] = totalCount;
        writeLocalData(data);
        return res.json({
            rank,
            times,
            count: dayCount(rawDay),
            unique: rawDay.unique || 0,
            today: rank,
            total: totalCount
        });
    }

    const totalRaw = data.counters['divinations:total'];
    res.json({
        rank: null,
        times: null,
        count: dayCount(rawDay),
        unique: (rawDay && rawDay.unique) || 0,
        today: null,
        total: typeof totalRaw === 'number' ? totalRaw : (totalRaw && totalRaw.count) || 0
    });
});

// 轻量埋点（本地版）
app.post('/api/track', (req, res) => {
    const { event, cardType, ref } = req.body || {};
    const ALLOWED = ['result_view', 'share_open', 'share_click', 'card_generated', 'landing'];
    if (event && ALLOWED.includes(event)) {
        const data = readLocalData();
        data.analytics = data.analytics || {};
        const day = shanghaiDate();
        const keys = [`ev:${event}:total`, `ev:${event}:${day}`];
        if (cardType) keys.push(`ev:${event}:card:${cardType}:total`);
        if (ref) keys.push(`ev:${event}:ref:${ref}:total`);
        keys.forEach((k) => { data.analytics[k] = (data.analytics[k] || 0) + 1; });
        writeLocalData(data);
    }
    res.status(204).end();
});

// 聚合指标（本地版）。未配置 STATS_TOKEN 时本地放行，线上必须带 token。
app.get('/api/stats', (req, res) => {
    const expected = process.env.STATS_TOKEN;
    if (expected) {
        const auth = req.headers.authorization || '';
        const headerToken = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
        if (headerToken !== expected) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }

    const data = readLocalData();
    const { dayCount } = require('../netlify/lib/divination-counter');
    const map = Object.assign({}, data.analytics || {});
    Object.entries(data.counters || {}).forEach(([key, value]) => {
        map[key] = (value && typeof value === 'object') ? dayCount(value) : value;
    });
    const { aggregateFromMap } = require('../netlify/lib/aggregate-stats');
    res.set('Cache-Control', 'no-store');
    res.json(aggregateFromMap(map));
});

// API 配置
const API_CONFIG = {
    apiKey: process.env.API_KEY,
    apiBase: process.env.API_BASE || 'https://openrouter.ai/api/v1',
    model: process.env.MODEL_NAME || 'stepfun/step-3.5-flash:free'
};

function buildPrompt(hexagramData, userQuestion, yaoResults) {
    const yaoDetails = yaoResults.map((yao, i) => {
        const position = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'][i];
        const typeText = yao.type === 'yang' ? '阳爻' : '阴爻';
        const movingText = yao.moving ? '（动爻）' : '';
        return `${position}：${typeText}${movingText}`;
    }).join('\n');

    return `你是一位精通周易六爻占卜的大师，请根据以下信息为求卦者解答：

**【求问之事】**
${userQuestion}

**【所得卦象】**
- 本卦：${hexagramData.main.name}
${hexagramData.main.nature ? `- 卦辞：${hexagramData.main.nature}` : ''}
${hexagramData.changed ? `- 变卦：${hexagramData.changed.name}` : '- 无动爻，不变卦'}
${hexagramData.hasMoving ? `- 动爻位置：${hexagramData.movingPositions.map(p => ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'][p-1]).join('、')}` : ''}

**【六爻详情】**（从初爻到上爻）
${yaoDetails}

请以专业且富有智慧的语气，结合卦象的含义，为求卦者解答所问之事。

**请使用 Markdown 格式回答**，结构如下：
## 卦象总览
简要说明本卦的核心含义和整体气象

## 针对所问
结合求问之事，给出具体解读

## 行动指引
- 给出具体可行的建议
- 指明宜与不宜

## 智者箴言
> 用一句富有哲理的话作为总结

请用温和、智慧的语气回答，避免过于绝对的断言，强调命运掌握在自己手中。`;
}

// 健康检查接口
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: '周易六爻占卜服务运行中',
        hasApiKey: !!API_CONFIG.apiKey
    });
});

// 获取配置（不返回 API Key）
app.get('/api/config', (req, res) => {
    res.json({
        model: API_CONFIG.model,
        hasApiKey: !!API_CONFIG.apiKey
    });
});

// 流式接口预检，避免前端探测时出现 404
app.options('/api/interpret-stream', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.status(204).end();
});

// AI 解卦代理接口
app.post('/api/interpret', async (req, res) => {
    const { hexagramData, userQuestion, yaoResults } = req.body;

    if (!hexagramData || !userQuestion) {
        return res.status(400).json({ 
            success: false, 
            error: '缺少必要参数' 
        });
    }

    if (!API_CONFIG.apiKey) {
        return res.status(500).json({ 
            success: false, 
            error: 'API Key 未配置' 
        });
    }

    const prompt = buildPrompt(hexagramData, userQuestion, yaoResults);

    try {
        // 调用 AI API
        const response = await fetch(`${API_CONFIG.apiBase}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_CONFIG.apiKey}`
            },
            body: JSON.stringify({
                model: API_CONFIG.model,
                messages: [
                    {
                        role: 'system',
                        content: '你是一位精通周易、博学多才的占卜大师，你的解读既符合传统易学，又充满人生智慧。你说话温和有礼，善于给人以启发和鼓励。请务必使用 Markdown 格式回答，包括标题(##)、加粗(**)、斜体(*)、引用(>)、列表(-)等，使内容层次分明、易于阅读。'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 8000
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API 请求失败:', response.status, errorText);
            throw new Error(`API 请求失败: ${response.status}`);
        }

        const data = await response.json();
        const interpretation = data.choices[0].message.content;

        res.json({
            success: true,
            content: interpretation
        });

    } catch (error) {
        console.error('解卦请求失败:', error);
        res.status(500).json({
            success: false,
            error: error.message || '解卦服务暂时不可用'
        });
    }
});

// AI 流式解卦代理接口
app.post('/api/interpret-stream', async (req, res) => {
    const { hexagramData, userQuestion, yaoResults } = req.body;

    if (!hexagramData || !userQuestion || !yaoResults) {
        return res.status(400).json({ error: '缺少必要参数' });
    }

    if (!API_CONFIG.apiKey) {
        return res.status(500).json({ error: 'API Key 未配置' });
    }

    const prompt = buildPrompt(hexagramData, userQuestion, yaoResults);

    try {
        const response = await fetch(`${API_CONFIG.apiBase}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_CONFIG.apiKey}`
            },
            body: JSON.stringify({
                model: API_CONFIG.model,
                messages: [
                    {
                        role: 'system',
                        content: '你是一位精通周易、博学多才的占卜大师。请使用 Markdown 简洁回答。'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 8000,
                stream: true
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('流式 API 请求失败:', response.status, errorText);
            return res.status(500).json({ error: `API 请求失败: ${response.status}` });
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.flushHeaders();

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

                const data = trimmedLine.slice(6);
                if (data === '[DONE]') {
                    res.write('data: [DONE]\n\n');
                    continue;
                }

                try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content;
                    if (content) {
                        res.write(`data: ${JSON.stringify({ content })}\n\n`);
                    }
                } catch (e) {
                    // 忽略不完整片段，等待下一次数据
                }
            }
        }

        if (buffer.trim().startsWith('data: ')) {
            const data = buffer.trim().slice(6);
            if (data !== '[DONE]') {
                try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content;
                    if (content) {
                        res.write(`data: ${JSON.stringify({ content })}\n\n`);
                    }
                } catch (e) {
                    // ignore
                }
            }
        }

        res.write('data: [DONE]\n\n');
        res.end();
    } catch (error) {
        console.error('流式解卦请求失败:', error);
        if (!res.headersSent) {
            return res.status(500).json({ error: error.message || '流式解卦失败' });
        }
        res.write(`data: ${JSON.stringify({ error: error.message || '流式解卦失败' })}\n\n`);
        res.end();
    }
});

// 启动服务器
app.listen(PORT, () => {
    console.log('==========================================');
    console.log('   周易六爻 · 铜钱占卜 - 服务已启动');
    console.log('==========================================');
    console.log(`   本地访问: http://localhost:${PORT}`);
    console.log(`   API 状态: ${API_CONFIG.apiKey ? '已配置' : '未配置'}`);
    console.log('==========================================');
});
