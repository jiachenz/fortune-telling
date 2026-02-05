/**
 * PDF 导出模块 - 将卦象和解读导出为 PDF
 * =========================================
 */

class PdfExportModule {
    constructor() {
        this.isExporting = false;
    }

    /**
     * 生成 PDF 导出内容的 HTML
     */
    generateExportHtml(hexagramData, userQuestion, interpretation) {
        const now = new Date();
        const dateStr = now.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // 生成六爻图形 HTML
        const yaoLines = hexagramData.yaoResults.map((yao, index) => {
            const isMoving = yao.moving;
            const isYang = yao.type === 'yang';
            
            if (isYang) {
                // 阳爻 - 实线
                const color = isMoving ? '#c41e3a' : '#d4af37';
                return `<div style="width: 60px; height: 8px; background: ${color}; margin: 4px 0; border-radius: 2px;"></div>`;
            } else {
                // 阴爻 - 断开的线
                const color = isMoving ? '#00a86b' : '#a0c4ff';
                return `
                    <div style="display: flex; gap: 8px; margin: 4px 0;">
                        <div style="width: 24px; height: 8px; background: ${color}; border-radius: 2px;"></div>
                        <div style="width: 24px; height: 8px; background: ${color}; border-radius: 2px;"></div>
                    </div>
                `;
            }
        }).reverse().join('');

        // 生成爻详情
        const yaoDetails = hexagramData.yaoResults.map((yao, i) => {
            const position = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'][i];
            const typeText = yao.type === 'yang' ? '阳爻 ━━━' : '阴爻 ━ ━';
            const movingText = yao.moving ? ' <span style="color: #c41e3a;">【动爻】</span>' : '';
            return `<div style="margin: 4px 0;">${position}：${typeText}${movingText}</div>`;
        }).join('');

        // 处理解读内容，转换 Markdown 为 HTML
        let interpretationHtml = interpretation;
        if (typeof marked !== 'undefined') {
            interpretationHtml = marked.parse(interpretation);
        }

        return `
            <div id="pdf-content" style="
                font-family: 'Noto Serif SC', 'SimSun', serif;
                padding: 40px;
                background: #fffef8;
                color: #2c2c2c;
                max-width: 800px;
                margin: 0 auto;
            ">
                <!-- 标题 -->
                <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #d4af37; padding-bottom: 20px;">
                    <h1 style="
                        font-size: 32px;
                        color: #c41e3a;
                        margin: 0 0 10px 0;
                        letter-spacing: 8px;
                    ">周易六爻 · 卦象解读</h1>
                    <p style="color: #888; font-size: 14px; margin: 0;">
                        占卜时间：${dateStr}
                    </p>
                </div>

                <!-- 所问之事 -->
                <div style="
                    background: linear-gradient(135deg, #fff8e7 0%, #fff5db 100%);
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 25px;
                    border-left: 4px solid #d4af37;
                ">
                    <h3 style="color: #c41e3a; margin: 0 0 10px 0; font-size: 16px;">📿 所问之事</h3>
                    <p style="margin: 0; font-size: 16px; line-height: 1.6;">${userQuestion}</p>
                </div>

                <!-- 卦象信息 -->
                <div style="
                    display: flex;
                    gap: 30px;
                    margin-bottom: 25px;
                    padding: 20px;
                    background: #fafafa;
                    border-radius: 8px;
                ">
                    <!-- 卦象图形 -->
                    <div style="text-align: center;">
                        <h4 style="color: #666; margin: 0 0 15px 0; font-size: 14px;">卦象</h4>
                        <div style="display: flex; flex-direction: column; align-items: center;">
                            ${yaoLines}
                        </div>
                    </div>
                    
                    <!-- 卦名和卦辞 -->
                    <div style="flex: 1;">
                        <h3 style="
                            color: #c41e3a;
                            font-size: 24px;
                            margin: 0 0 10px 0;
                        ">${hexagramData.main.name}${hexagramData.changed ? ' → ' + hexagramData.changed.name : ''}</h3>
                        ${hexagramData.main.nature ? `<p style="color: #666; font-style: italic; margin: 0 0 15px 0;">「${hexagramData.main.nature}」</p>` : ''}
                        
                        <div style="font-size: 13px; color: #555;">
                            ${yaoDetails}
                        </div>
                    </div>
                </div>

                <!-- 解读内容 -->
                <div style="
                    background: #fff;
                    padding: 25px;
                    border-radius: 8px;
                    border: 1px solid #eee;
                    line-height: 1.8;
                ">
                    <style>
                        #pdf-content h2 { color: #c41e3a; font-size: 18px; margin: 20px 0 10px 0; padding-bottom: 8px; border-bottom: 1px solid #eee; }
                        #pdf-content h2:first-child { margin-top: 0; }
                        #pdf-content h3 { color: #d4af37; font-size: 16px; margin: 15px 0 8px 0; }
                        #pdf-content p { margin: 10px 0; }
                        #pdf-content ul, #pdf-content ol { margin: 10px 0; padding-left: 20px; }
                        #pdf-content li { margin: 5px 0; }
                        #pdf-content strong { color: #c41e3a; }
                        #pdf-content em { color: #00a86b; font-style: normal; }
                        #pdf-content blockquote { 
                            background: linear-gradient(135deg, #fff8e7 0%, #fff5db 100%);
                            border-left: 4px solid #d4af37;
                            padding: 15px 20px;
                            margin: 15px 0;
                            border-radius: 0 8px 8px 0;
                            font-style: italic;
                        }
                        #pdf-content hr { border: none; height: 1px; background: linear-gradient(90deg, transparent, #d4af37, transparent); margin: 20px 0; }
                    </style>
                    ${interpretationHtml}
                </div>

                <!-- 页脚 -->
                <div style="
                    text-align: center;
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #eee;
                    color: #999;
                    font-size: 12px;
                ">
                    <p style="margin: 0;">☯ 周易六爻 · 铜钱占卜 ☯</p>
                    <p style="margin: 5px 0 0 0;">卦象仅供参考，命运掌握在自己手中</p>
                </div>
            </div>
        `;
    }

    /**
     * 导出为 PDF
     */
    async exportToPdf(hexagramData, userQuestion, interpretation) {
        if (this.isExporting) return;
        
        this.isExporting = true;

        // 创建临时容器
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.innerHTML = this.generateExportHtml(hexagramData, userQuestion, interpretation);
        document.body.appendChild(container);

        // 配置 PDF 选项
        const options = {
            margin: 10,
            filename: `周易占卜_${hexagramData.main.name}_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
                scale: 2,
                useCORS: true,
                letterRendering: true
            },
            jsPDF: { 
                unit: 'mm', 
                format: 'a4', 
                orientation: 'portrait' 
            }
        };

        try {
            // 生成 PDF
            await html2pdf().set(options).from(container.querySelector('#pdf-content')).save();
        } catch (error) {
            console.error('PDF 导出失败:', error);
            alert('PDF 导出失败，请稍后重试');
        } finally {
            // 清理临时容器
            document.body.removeChild(container);
            this.isExporting = false;
        }
    }
}

// 导出模块
window.PdfExportModule = PdfExportModule;
