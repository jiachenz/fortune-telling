/**
 * API 模块 - 处理与大模型的通信
 * ==============================
 */

class ApiModule {
    constructor() {
        this.config = {
            apiKey: '',
            apiBase: 'https://openrouter.ai/api/v1',
            model: 'stepfun/step-3.5-flash:free'
        };
        this.useProxy = true;
        this.proxyBase = '/api';
        this.useStream = true;
        this.streamAvailable = false; // 流式端点是否可用
    }

    /**
     * 检查后端代理是否可用
     */
    async checkProxyAvailable() {
        try {
            const response = await fetch(`${this.proxyBase}/health`, { method: 'GET' });
            if (response.ok) {
                const data = await response.json();
                this.useProxy = data.hasApiKey;
                // 检测流式端点
                this.streamAvailable = await this.checkStreamAvailable();
                return data.hasApiKey;
            }
            return false;
        } catch (error) {
            console.log('后端代理不可用');
            this.useProxy = false;
            this.streamAvailable = false;
            return false;
        }
    }

    /**
     * 检查流式端点是否可用
     */
    async checkStreamAvailable() {
        try {
            const response = await fetch(`${this.proxyBase}/interpret-stream`, {
                method: 'OPTIONS'
            });
            return response.ok || response.status === 204;
        } catch (error) {
            return false;
        }
    }

    saveConfig(config) {
        this.config = {
            apiKey: config.apiKey || this.config.apiKey,
            apiBase: config.apiBase || 'https://openrouter.ai/api/v1',
            model: config.model || 'stepfun/step-3.5-flash:free'
        };
        localStorage.setItem('fortune_api_config', JSON.stringify(this.config));
    }

    loadConfig() {
        const saved = localStorage.getItem('fortune_api_config');
        if (saved) {
            this.config = JSON.parse(saved);
        }
        return this.config;
    }

    hasApiKey() {
        return this.useProxy || !!this.config.apiKey;
    }

    getConfig() {
        return {
            ...this.config,
            useProxy: this.useProxy,
            useStream: this.useStream && this.streamAvailable
        };
    }

    /**
     * 流式获取解卦
     */
    async getInterpretationStream(hexagramData, userQuestion, yaoResults, onChunk, onComplete, onError) {
        let fullContent = '';
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000); // 120秒超时

            const response = await fetch(`${this.proxyBase}/interpret-stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({ hexagramData, userQuestion, yaoResults })
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`请求失败: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = ''; // 缓冲区处理不完整的数据

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                // 将新数据追加到缓冲区
                buffer += decoder.decode(value, { stream: true });
                
                // 按换行符分割，保留最后一个可能不完整的部分
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) continue;
                    
                    if (trimmedLine.startsWith('data: ')) {
                        const data = trimmedLine.slice(6);
                        if (data === '[DONE]') continue;
                        
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.content) {
                                fullContent += parsed.content;
                                onChunk(parsed.content, fullContent);
                            }
                            if (parsed.error) {
                                throw new Error(parsed.error);
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
                        if (parsed.content) {
                            fullContent += parsed.content;
                            onChunk(parsed.content, fullContent);
                        }
                    } catch (e) {}
                }
            }

            onComplete(fullContent);
            return { success: true, content: fullContent };

        } catch (error) {
            console.error('流式请求失败:', error);
            const isTimeout = error.name === 'AbortError';
            onError(isTimeout ? 'AI 响应超时' : error.message);
            return { success: false, error: error.message, useLocal: true };
        }
    }

    /**
     * 普通方式获取解卦
     */
    async getInterpretation(hexagramData, userQuestion, yaoResults) {
        if (this.useProxy) {
            const result = await this.getInterpretationViaProxy(hexagramData, userQuestion, yaoResults);
            if (result.success) return result;
        }

        if (this.config.apiKey) {
            return await this.getInterpretationDirect(hexagramData, userQuestion, yaoResults);
        }

        return { success: false, error: '未配置 API Key' };
    }

    async getInterpretationViaProxy(hexagramData, userQuestion, yaoResults) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(`${this.proxyBase}/interpret`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({ hexagramData, userQuestion, yaoResults })
            });

            clearTimeout(timeoutId);
            const data = await response.json();
            
            if (data.useLocal) {
                return { success: false, error: data.error, useLocal: true };
            }
            
            if (!response.ok || !data.success) {
                throw new Error(data.error || `请求失败: ${response.status}`);
            }

            return { success: true, content: data.content };

        } catch (error) {
            const isTimeout = error.name === 'AbortError';
            return {
                success: false,
                error: isTimeout ? 'AI 响应超时' : error.message,
                useLocal: true
            };
        }
    }

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
                        { role: 'system', content: '你是周易占卜大师，用Markdown格式简洁回答。' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 8000
                })
            });

            if (!response.ok) {
                throw new Error(`API请求失败: ${response.status}`);
            }

            const data = await response.json();
            return { success: true, content: data.choices[0].message.content };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    buildPrompt(hexagramData, userQuestion, yaoResults) {
        const yaoDetails = yaoResults.map((yao, i) => {
            const position = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'][i];
            const typeText = yao.type === 'yang' ? '阳爻' : '阴爻';
            const movingText = yao.moving ? '（动爻）' : '';
            return `${position}：${typeText}${movingText}`;
        }).join('\n');

        return `**求问：** ${userQuestion}

**卦象：** ${hexagramData.main.name}${hexagramData.changed ? ' → ' + hexagramData.changed.name : ''}
${hexagramData.main.nature ? `**卦辞：** ${hexagramData.main.nature}` : ''}

**六爻：**
${yaoDetails}

请用Markdown格式回答，包含：## 卦象总览、## 针对所问、## 行动指引、## 智者箴言（用引用格式）。`;
    }

    generateLocalInterpretation(hexagramData, userQuestion, yaoResults) {
        const { main, changed, hasMoving, movingPositions } = hexagramData;
        
        let text = `## 卦象总览\n\n`;
        text += `您所得卦象为 **「${main.name}」**`;
        if (main.nature) text += `，卦辞：*「${main.nature}」*`;
        text += `。\n\n`;
        
        if (hasMoving && changed) {
            text += `有 **动爻** 位于${movingPositions.map(p => ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'][p-1]).join('、')}，变为 **「${changed.name}」**。\n\n`;
        }
        
        text += `## 针对所问\n\n关于「${userQuestion}」：\n\n`;
        
        const yangCount = yaoResults.filter(y => y.type === 'yang').length;
        if (yangCount >= 4) {
            text += `此卦阳气旺盛，**积极向上**，时机有利，可主动进取。\n\n`;
        } else if (yangCount <= 2) {
            text += `此卦阴气较重，**收敛蓄势**，建议以静制动，耐心等待。\n\n`;
        } else {
            text += `此卦阴阳均衡，**平稳发展**，按既定计划稳步推进。\n\n`;
        }
        
        text += `## 行动指引\n\n- **宜**：保持积极心态，脚踏实地\n- **宜**：把握时机，顺势而为\n- **忌**：急躁冒进，好高骛远\n\n`;
        text += `## 智者箴言\n\n> 易经讲究"自强不息"与"厚德载物"，卦象仅供参考，命运掌握在自己手中。`;
        
        return text;
    }
}

window.ApiModule = ApiModule;
