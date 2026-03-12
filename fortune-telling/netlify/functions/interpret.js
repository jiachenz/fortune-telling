/**
 * AI 解卦接口 - 非流式版本
 * POST /api/interpret
 */

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch (e) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: '无效的请求数据' })
        };
    }

    const { hexagramData, userQuestion, yaoResults } = body;

    if (!hexagramData || !userQuestion || !yaoResults) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: '缺少必要参数' })
        };
    }

    const API_KEY = process.env.API_KEY;
    const API_BASE = process.env.API_BASE || 'https://openrouter.ai/api/v1';
    const MODEL_NAME = process.env.MODEL_NAME || 'stepfun/step-3.5-flash:free';

    if (!API_KEY) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'API Key 未配置', useLocal: true })
        };
    }

    // 构建提示词
    const yaoDetails = yaoResults.map((yao, i) => {
        const position = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'][i];
        const typeText = yao.type === 'yang' ? '阳爻' : '阴爻';
        const movingText = yao.moving ? '（动爻）' : '';
        return `${position}：${typeText}${movingText}`;
    }).join('\n');

    const prompt = `【求问】${userQuestion}
【卦象】${hexagramData.main.name}${hexagramData.changed ? ' → ' + hexagramData.changed.name : ''}
【六爻】
${yaoDetails}

用Markdown回答，包含：## 卦象总览、## 针对所问、## 行动指引、## 智者箴言（引用格式）。简洁有力。`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(`${API_BASE}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            signal: controller.signal,
            body: JSON.stringify({
                model: MODEL_NAME,
                messages: [
                    { role: 'system', content: '你是周易占卜大师，用Markdown简洁回答。' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 8000
            })
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error('AI 返回内容为空');
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, content })
        };

    } catch (error) {
        console.error('请求失败:', error);
        const isTimeout = error.name === 'AbortError';
        
        return {
            statusCode: isTimeout ? 504 : 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: isTimeout ? 'AI 响应超时' : error.message,
                useLocal: true
            })
        };
    }
};
