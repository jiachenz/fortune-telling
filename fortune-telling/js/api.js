/**
 * API 模块 - 处理与大模型的通信
 * ==============================
 * 支持两种模式：
 * 1. 后端代理模式（推荐）- API Key 存储在服务器
 * 2. 直接调用模式 - API Key 存储在浏览器
 */

class ApiModule {
    constructor() {
        this.config = {
            apiKey: '',  // 不再硬编码 API Key
            apiBase: 'https://api.siliconflow.cn/v1',
            model: 'Pro/zai-org/GLM-4.7'
        };
        this.useProxy = true; // 优先使用后端代理
        this.proxyBase = '/api'; // 后端代理地址
    }

    /**
     * 检查后端代理是否可用
     */
    async checkProxyAvailable() {
        try {
            const response = await fetch(`${this.proxyBase}/health`, {
                method: 'GET',
                timeout: 3000
            });
            if (response.ok) {
                const data = await response.json();
                this.useProxy = data.hasApiKey;
                return data.hasApiKey;
            }
            return false;
        } catch (error) {
            console.log('后端代理不可用，将使用直接调用模式');
            this.useProxy = false;
            return false;
        }
    }

    /**
     * 保存 API 配置到本地存储
     */
    saveConfig(config) {
        this.config = {
            apiKey: config.apiKey || this.config.apiKey,
            apiBase: config.apiBase || 'https://api.siliconflow.cn/v1',
            model: config.model || 'Pro/zai-org/GLM-4.7'
        };
        localStorage.setItem('fortune_api_config', JSON.stringify(this.config));
    }

    /**
     * 从本地存储加载 API 配置
     */
    loadConfig() {
        const saved = localStorage.getItem('fortune_api_config');
        if (saved) {
            this.config = JSON.parse(saved);
        }
        return this.config;
    }

    /**
     * 检查是否已配置 API Key（本地或后端）
     */
    hasApiKey() {
        return this.useProxy || !!this.config.apiKey;
    }

    /**
     * 获取当前配置
     */
    getConfig() {
        return {
            ...this.config,
            useProxy: this.useProxy
        };
    }

    /**
     * 调用 AI 接口获取解卦（自动选择模式）
     */
    async getInterpretation(hexagramData, userQuestion, yaoResults) {
        // 优先尝试后端代理
        if (this.useProxy) {
            const result = await this.getInterpretationViaProxy(hexagramData, userQuestion, yaoResults);
            if (result.success) {
                return result;
            }
            // 代理失败，尝试直接调用
            console.log('后端代理调用失败，尝试直接调用');
        }

        // 直接调用 API
        if (this.config.apiKey) {
            return await this.getInterpretationDirect(hexagramData, userQuestion, yaoResults);
        }

        return {
            success: false,
            error: '未配置 API Key'
        };
    }

    /**
     * 通过后端代理调用
     */
    async getInterpretationViaProxy(hexagramData, userQuestion, yaoResults) {
        try {
            const response = await fetch(`${this.proxyBase}/interpret`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    hexagramData,
                    userQuestion,
                    yaoResults
                })
            });

            const data = await response.json();
            
            if (!response.ok || !data.success) {
                throw new Error(data.error || `请求失败: ${response.status}`);
            }

            return {
                success: true,
                content: data.content
            };

        } catch (error) {
            console.error('后端代理调用失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 直接调用 AI API
     */
    async getInterpretationDirect(hexagramData, userQuestion, yaoResults) {
        const prompt = this.buildPrompt(hexagramData, userQuestion, yaoResults);

        try {
            const response = await fetch(`${this.config.apiBase}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify({
                    model: this.config.model,
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
                throw new Error(`API请求失败: ${response.status}`);
            }

            const data = await response.json();
            return {
                success: true,
                content: data.choices[0].message.content
            };

        } catch (error) {
            console.error('AI解卦失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 构建解卦提示词
     */
    buildPrompt(hexagramData, userQuestion, yaoResults) {
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

    /**
     * 生成本地解读（当 API 不可用时）
     */
    generateLocalInterpretation(hexagramData, userQuestion, yaoResults) {
        const { main, changed, hasMoving, movingPositions } = hexagramData;
        
        let text = `## 卦象总览\n\n`;
        text += `您所得的卦象为 **「${main.name}」**`;
        if (main.nature) {
            text += `，卦辞曰：*「${main.nature}」*`;
        }
        text += `。\n\n`;
        
        if (hasMoving && changed) {
            text += `此卦有 **动爻**，位于${movingPositions.map(p => ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'][p-1]).join('、')}，`;
            text += `变为 **「${changed.name}」**。动爻代表事情正在变化之中，需要特别关注变化的方向。\n\n`;
        }
        
        text += `## 针对所问\n\n`;
        text += `关于「${userQuestion}」：\n\n`;
        
        const yangCount = yaoResults.filter(y => y.type === 'yang').length;
        if (yangCount >= 4) {
            text += `此卦阳气旺盛，显示出 **积极向上** 的态势。当前时机较为有利，可以主动进取。\n\n`;
        } else if (yangCount <= 2) {
            text += `此卦阴气较重，显示出 **收敛蓄势** 的征兆。建议以静制动，耐心等待时机。\n\n`;
        } else {
            text += `此卦阴阳均衡，显示出 **平稳发展** 的迹象。可按既定计划稳步推进。\n\n`;
        }
        
        text += `## 行动指引\n\n`;
        text += `- **宜**：保持积极心态，脚踏实地\n`;
        text += `- **宜**：把握时机，顺势而为\n`;
        text += `- **忌**：急躁冒进，好高骛远\n\n`;
        
        text += `---\n\n`;
        
        text += `## 智者箴言\n\n`;
        text += `> 易经讲究"**自强不息**"与"**厚德载物**"，卦象仅供参考，命运始终掌握在自己手中。愿您心想事成，诸事顺遂。`;
        
        return text;
    }
}

// 导出模块
window.ApiModule = ApiModule;
