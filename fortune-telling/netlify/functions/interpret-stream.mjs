/**
 * AI 解卦接口 - 流式响应版本
 * POST /api/interpret-stream
 * 
 * 使用 Server-Sent Events (SSE) 实现流式传输
 */

export default async (request, context) => {
    // 只允许 POST 请求
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            }
        });
    }

    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // 解析请求
    let body;
    try {
        body = await request.json();
    } catch (e) {
        return new Response(JSON.stringify({ error: '无效的请求数据' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const { hexagramData, userQuestion, yaoResults } = body;

    if (!hexagramData || !userQuestion || !yaoResults) {
        return new Response(JSON.stringify({ error: '缺少必要参数' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // API 配置（使用 process.env）
    const API_KEY = process.env.API_KEY;
    const API_BASE = process.env.API_BASE || 'https://api.siliconflow.cn/v1';
    const MODEL_NAME = process.env.MODEL_NAME || 'Pro/zai-org/GLM-4.7';

    if (!API_KEY) {
        return new Response(JSON.stringify({ error: 'API Key 未配置' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // 构建提示词
    const yaoDetails = yaoResults.map((yao, i) => {
        const position = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'][i];
        const typeText = yao.type === 'yang' ? '阳爻' : '阴爻';
        const movingText = yao.moving ? '（动爻）' : '';
        return `${position}：${typeText}${movingText}`;
    }).join('\n');

    const prompt = `你是一位精通周易六爻占卜的大师，请根据以下信息为求卦者解答：

**【求问之事】**
${userQuestion}

**【所得卦象】**
- 本卦：${hexagramData.main.name}
${hexagramData.main.nature ? `- 卦辞：${hexagramData.main.nature}` : ''}
${hexagramData.changed ? `- 变卦：${hexagramData.changed.name}` : '- 无动爻，不变卦'}
${hexagramData.hasMoving ? `- 动爻位置：${hexagramData.movingPositions.map(p => ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'][p-1]).join('、')}` : ''}

**【六爻详情】**（从初爻到上爻）
${yaoDetails}

请用Markdown格式回答，包含：## 卦象总览、## 针对所问、## 行动指引、## 智者箴言（用引用格式）。简洁有力，避免冗长。`;

    try {
        // 调用 AI API（流式）
        const response = await fetch(`${API_BASE}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: MODEL_NAME,
                messages: [
                    {
                        role: 'system',
                        content: '你是周易占卜大师，用Markdown格式简洁回答。'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 800,
                stream: true  // 启用流式响应
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API 请求失败:', response.status, errorText);
            return new Response(JSON.stringify({ error: `API 请求失败: ${response.status}` }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 创建 TransformStream 来处理流式数据
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = new TextEncoder();

        // 异步处理流式响应
        (async () => {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = ''; // 缓冲区处理不完整的数据

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    // 将新数据追加到缓冲区
                    buffer += decoder.decode(value, { stream: true });
                    
                    // 按换行符分割，保留最后一个可能不完整的部分
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; // 最后一部分可能不完整，留到下次处理

                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (!trimmedLine) continue;
                        
                        if (trimmedLine.startsWith('data: ')) {
                            const data = trimmedLine.slice(6);
                            if (data === '[DONE]') {
                                await writer.write(encoder.encode('data: [DONE]\n\n'));
                                continue;
                            }
                            try {
                                const parsed = JSON.parse(data);
                                const content = parsed.choices?.[0]?.delta?.content;
                                if (content) {
                                    // 发送 SSE 格式的数据
                                    await writer.write(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                                }
                            } catch (e) {
                                // JSON 解析失败，可能是不完整的数据，忽略
                            }
                        }
                    }
                }
                
                // 处理缓冲区中剩余的数据
                if (buffer.trim().startsWith('data: ')) {
                    const data = buffer.trim().slice(6);
                    if (data !== '[DONE]') {
                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content;
                            if (content) {
                                await writer.write(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                            }
                        } catch (e) {}
                    }
                }
                
                await writer.write(encoder.encode('data: [DONE]\n\n'));
            } catch (error) {
                console.error('流处理错误:', error);
                await writer.write(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`));
            } finally {
                await writer.close();
            }
        })();

        // 返回流式响应
        return new Response(readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*'
            }
        });

    } catch (error) {
        console.error('请求失败:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
};

// Netlify 函数配置
export const config = {
    path: '/api/interpret-stream'
};
