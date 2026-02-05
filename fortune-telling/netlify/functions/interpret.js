/**
 * AI 解卦接口
 * POST /api/interpret
 * 
 * 使用 Node.js 18+ 内置的 fetch API
 */

exports.handler = async (event, context) => {
    // CORS 预检请求
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            body: ''
        };
    }

    // 只允许 POST 请求
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, error: 'Method Not Allowed' })
        };
    }

    // 解析请求体
    let body;
    try {
        body = JSON.parse(event.body);
    } catch (e) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, error: '无效的请求数据' })
        };
    }

    const { hexagramData, userQuestion, yaoResults } = body;

    // 验证参数
    if (!hexagramData || !userQuestion || !yaoResults) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, error: '缺少必要参数' })
        };
    }

    // 检查 API Key
    const API_KEY = process.env.API_KEY;
    const API_BASE = process.env.API_BASE || 'https://api.siliconflow.cn/v1';
    const MODEL_NAME = process.env.MODEL_NAME || 'Pro/zai-org/GLM-4.7';

    if (!API_KEY) {
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, error: 'API Key 未配置' })
        };
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

    try {
        // 调用 AI API
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
                        content: '你是一位精通周易、博学多才的占卜大师，你的解读既符合传统易学，又充满人生智慧。你说话温和有礼，善于给人以启发和鼓励。请务必使用 Markdown 格式回答，包括标题(##)、加粗(**)、斜体(*)、引用(>)、列表(-)等，使内容层次分明、易于阅读。'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 1500
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API 请求失败:', response.status, errorText);
            throw new Error(`API 请求失败: ${response.status}`);
        }

        const data = await response.json();
        const interpretation = data.choices[0].message.content;

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                content: interpretation
            })
        };

    } catch (error) {
        console.error('解卦请求失败:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: error.message || '解卦服务暂时不可用'
            })
        };
    }
};
