/**
 * 渲染模块 - 处理内容展示和 Markdown 渲染
 * ==========================================
 */

class RendererModule {
    constructor() {
        this.aiResponseElement = null;
        this.hexagramVisualElement = null;
        this.hexagramNameElement = null;
        this.hexagramNatureElement = null;
        this.displayQuestionElement = null;
        this.streamContainer = null;
        this.streamBuffer = '';
    }

    /**
     * 初始化渲染模块
     */
    init(options) {
        this.aiResponseElement = options.aiResponse;
        this.hexagramVisualElement = options.hexagramVisual;
        this.hexagramNameElement = options.hexagramName;
        this.hexagramNatureElement = options.hexagramNature;
        this.displayQuestionElement = options.displayQuestion;
    }

    /**
     * 渲染卦象图形
     */
    renderHexagramVisual(yaoResults) {
        if (!this.hexagramVisualElement) return;
        
        this.hexagramVisualElement.innerHTML = '';
        
        // 从上爻到初爻显示（反向）
        for (let i = 5; i >= 0; i--) {
            const yao = yaoResults[i];
            const yaoLine = document.createElement('div');
            yaoLine.className = 'yao-line';
            
            if (yao.moving) {
                yaoLine.classList.add(yao.type === 'yang' ? 'yang-moving' : 'yin-moving');
            } else {
                yaoLine.classList.add(yao.type);
            }
            
            this.hexagramVisualElement.appendChild(yaoLine);
        }
    }

    /**
     * 渲染卦象名称
     */
    renderHexagramName(hexagramData) {
        if (!this.hexagramNameElement) return;
        
        let nameText = hexagramData.main.name;
        if (hexagramData.changed) {
            nameText += ` → ${hexagramData.changed.name}`;
        }
        this.hexagramNameElement.textContent = nameText;
        
        if (this.hexagramNatureElement) {
            this.hexagramNatureElement.textContent = hexagramData.main.nature;
        }
    }

    /**
     * 渲染用户问题
     */
    renderUserQuestion(question) {
        if (this.displayQuestionElement) {
            this.displayQuestionElement.textContent = question;
        }
    }

    /**
     * 显示加载状态
     */
    showLoading() {
        if (!this.aiResponseElement) return;
        
        this.aiResponseElement.innerHTML = `
            <div class="loading-indicator">
                <div class="loading-spinner"></div>
                <span>天机推演中...</span>
            </div>
        `;
    }

    /**
     * 显示错误信息
     */
    showError(message) {
        if (!this.aiResponseElement) return;
        
        this.aiResponseElement.innerHTML = `
            <div style="color: #c41e3a; margin-bottom: 16px;">
                ⚠️ AI解卦服务暂时不可用：${message}
            </div>
        `;
    }

    /**
     * 使用 Markdown 渲染内容（逐段淡入效果）
     */
    renderMarkdown(text) {
        if (!this.aiResponseElement) return;
        
        this.aiResponseElement.innerHTML = '<div class="markdown-content"></div>';
        const container = this.aiResponseElement.querySelector('.markdown-content');
        
        // 配置 marked 选项
        if (typeof marked !== 'undefined') {
            marked.setOptions({
                breaks: true,
                gfm: true
            });
        }
        
        // 将文本按段落分割，实现逐段显示效果
        const paragraphs = text.split(/\n\n+/);
        let currentIndex = 0;
        
        const showNextParagraph = () => {
            if (currentIndex < paragraphs.length) {
                const paragraph = paragraphs[currentIndex];
                const tempDiv = document.createElement('div');
                tempDiv.className = 'md-paragraph fade-in';
                
                if (typeof marked !== 'undefined') {
                    tempDiv.innerHTML = marked.parse(paragraph);
                } else {
                    tempDiv.innerHTML = paragraph.replace(/\n/g, '<br>');
                }
                
                container.appendChild(tempDiv);
                currentIndex++;
                
                this.aiResponseElement.scrollTop = this.aiResponseElement.scrollHeight;
                setTimeout(showNextParagraph, 150 + paragraph.length * 2);
            }
        };
        
        showNextParagraph();
    }

    /**
     * 初始化流式渲染
     */
    initStreamRender() {
        if (!this.aiResponseElement) return;
        
        this.streamBuffer = '';
        this.aiResponseElement.innerHTML = '<div class="markdown-content stream-content"></div>';
        this.streamContainer = this.aiResponseElement.querySelector('.markdown-content');
        
        if (typeof marked !== 'undefined') {
            marked.setOptions({ breaks: true, gfm: true });
        }
    }

    /**
     * 追加流式内容
     */
    appendStreamContent(chunk) {
        if (!this.streamContainer) return;
        
        this.streamBuffer += chunk;
        
        if (typeof marked !== 'undefined') {
            this.streamContainer.innerHTML = marked.parse(this.streamBuffer);
        } else {
            this.streamContainer.innerHTML = this.streamBuffer.replace(/\n/g, '<br>');
        }
        
        this.aiResponseElement.scrollTop = this.aiResponseElement.scrollHeight;
    }

    /**
     * 完成流式渲染
     */
    finishStreamRender() {
        if (this.streamContainer) {
            this.streamContainer.classList.add('finished');
            if (this.streamBuffer && typeof marked !== 'undefined') {
                this.streamContainer.innerHTML = marked.parse(this.streamBuffer);
            }
        }
        return this.streamBuffer;
    }

    /**
     * 获取当前流式内容
     */
    getStreamContent() {
        return this.streamBuffer;
    }
}

// 导出模块
window.RendererModule = RendererModule;
