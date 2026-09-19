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

    const { hexagramData, userQuestion, yaoResults, history, followUp } = body;

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

    const {
        buildSystemPrompt,
        buildUserPrompt,
        normalizeHistory,
        normalizeFollowUp
    } = require('../lib/prompt.js');

    const followUpText = normalizeFollowUp(followUp);
    const historyNorm = normalizeHistory(history);

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
                    { role: 'system', content: buildSystemPrompt({ followUp: followUpText }) },
                    {
                        role: 'user',
                        content: buildUserPrompt(hexagramData, userQuestion, yaoResults, {
                            followUp: followUpText,
                            history: historyNorm
                        })
                    }
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
