/**
 * 长截图导出模块 - 将卦象和解读导出为 PNG 长图
 * ================================================
 */

class PngExportModule {
    constructor() {
        this.isExporting = false;
    }

    /**
     * 生成导出内容的 HTML
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
        const yaoLines = hexagramData.yaoResults.map((yao) => {
            const isMoving = yao.moving;
            const isYang = yao.type === 'yang';

            if (isYang) {
                const color = isMoving ? '#c41e3a' : '#d4af37';
                const shadow = isMoving
                    ? '0 0 8px rgba(196,30,58,0.6)'
                    : '0 0 6px rgba(212,175,55,0.4)';
                return `<div style="width:70px;height:10px;background:${color};margin:5px 0;border-radius:2px;box-shadow:${shadow};"></div>`;
            } else {
                const color = isMoving ? '#e67e22' : '#a0c4ff';
                const shadow = isMoving
                    ? '0 0 8px rgba(230,126,34,0.7)'
                    : '0 0 6px rgba(160,196,255,0.4)';
                return `
                    <div style="display:flex;gap:10px;margin:5px 0;">
                        <div style="width:28px;height:10px;background:${color};border-radius:2px;box-shadow:${shadow};"></div>
                        <div style="width:28px;height:10px;background:${color};border-radius:2px;box-shadow:${shadow};"></div>
                    </div>`;
            }
        }).reverse().join('');

        // 生成爻详情
        const yaoDetails = hexagramData.yaoResults.map((yao, i) => {
            const position = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'][i];
            const typeText = yao.type === 'yang' ? '阳爻 ━━━' : '阴爻 ━ ━';
            const movingBadge = yao.moving
                ? `<span style="display:inline-block;background:#c41e3a;color:#fff;font-size:11px;padding:1px 6px;border-radius:3px;margin-left:6px;">动爻</span>`
                : '';
            return `<div style="margin:5px 0;font-size:13px;color:#555;">${position}：${typeText}${movingBadge}</div>`;
        }).join('');

        // Markdown 转 HTML
        let interpretationHtml = interpretation;
        if (typeof marked !== 'undefined') {
            interpretationHtml = marked.parse(interpretation);
        }

        return `
            <div id="screenshot-content" style="
                font-family: 'Noto Serif SC', 'SimSun', serif;
                padding: 48px 40px;
                background: #fffef5;
                color: #2c2c2c;
                width: 700px;
                box-sizing: border-box;
            ">
                <!-- 顶部装饰线 -->
                <div style="height:4px;background:#c41e3a;border-radius:2px;margin-bottom:32px;"></div>

                <!-- 标题 -->
                <div style="text-align:center;margin-bottom:28px;">
                    <div style="font-size:13px;color:#aaa;letter-spacing:3px;margin-bottom:8px;">☯ 周易六爻 · 铜钱占卜 ☯</div>
                    <h1 style="font-size:30px;color:#c41e3a;margin:0 0 8px 0;letter-spacing:8px;">卦象解读</h1>
                    <p style="color:#999;font-size:13px;margin:0;">占卜时间：${dateStr}</p>
                </div>

                <!-- 所问之事 -->
                <div style="
                    background:#fff8e7;
                    padding:18px 20px;
                    border-radius:8px;
                    margin-bottom:22px;
                    border-left:4px solid #d4af37;
                ">
                    <div style="color:#c41e3a;font-weight:600;font-size:14px;margin-bottom:8px;">📿 所问之事</div>
                    <p style="margin:0;font-size:16px;line-height:1.7;">${userQuestion}</p>
                </div>

                <!-- 卦象信息 -->
                <div style="
                    display:flex;
                    gap:28px;
                    margin-bottom:22px;
                    padding:20px;
                    background:rgba(0,0,0,0.03);
                    border-radius:8px;
                    border:1px solid rgba(212,175,55,0.2);
                ">
                    <div style="text-align:center;flex-shrink:0;">
                        <div style="font-size:12px;color:#999;margin-bottom:10px;letter-spacing:2px;">卦象</div>
                        <div style="display:flex;flex-direction:column;align-items:center;">
                            ${yaoLines}
                        </div>
                    </div>
                    <div style="flex:1;padding-top:4px;">
                        <h3 style="color:#c41e3a;font-size:22px;margin:0 0 8px 0;">
                            ${hexagramData.main.name}${hexagramData.changed ? ' → ' + hexagramData.changed.name : ''}
                        </h3>
                        ${hexagramData.main.nature ? `<p style="color:#888;font-style:italic;margin:0 0 12px 0;font-size:14px;">「${hexagramData.main.nature}」</p>` : ''}
                        <div>${yaoDetails}</div>
                    </div>
                </div>

                <!-- 解读内容 -->
                <div style="
                    background:#fff;
                    padding:24px;
                    border-radius:8px;
                    border:1px solid #eee;
                    line-height:1.8;
                    font-size:15px;
                ">
                    <style>
                        #screenshot-content h2 { color:#c41e3a;font-size:18px;margin:20px 0 10px;padding-bottom:6px;border-bottom:1px solid #eee; }
                        #screenshot-content h2:first-child { margin-top:0; }
                        #screenshot-content h3 { color:#d4af37;font-size:16px;margin:14px 0 8px; }
                        #screenshot-content p { margin:10px 0; }
                        #screenshot-content ul, #screenshot-content ol { margin:10px 0;padding-left:20px; }
                        #screenshot-content li { margin:5px 0; }
                        #screenshot-content strong { color:#c41e3a; }
                        #screenshot-content em { color:#00a86b;font-style:normal; }
                        #screenshot-content blockquote {
                            background:#fff8e7;
                            border-left:4px solid #d4af37;
                            padding:14px 18px;
                            margin:14px 0;
                            border-radius:0 8px 8px 0;
                            font-style:italic;
                        }
                        #screenshot-content hr { border:none;height:1px;background:#d4af37;margin:18px 0; }
                    </style>
                    ${interpretationHtml}
                </div>

                <!-- 底部装饰 -->
                <div style="text-align:center;margin-top:28px;color:#bbb;font-size:12px;">
                    <div style="height:1px;background:#d4af37;margin-bottom:16px;"></div>
                    <p style="margin:0;">卦象仅供参考，命运掌握在自己手中</p>
                </div>
            </div>
        `;
    }

    /**
     * 导出为长截图 PNG
     */
    async exportToPng(hexagramData, userQuestion, interpretation) {
        if (this.isExporting) return;
        this.isExporting = true;

        // 创建屏幕外容器，绝对定位移出可视区域
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:700px;z-index:-1;';
        wrapper.innerHTML = this.generateExportHtml(hexagramData, userQuestion, interpretation);
        document.body.appendChild(wrapper);

        const content = wrapper.querySelector('#screenshot-content');

        // 等待一帧确保浏览器完成布局计算
        await new Promise(r => requestAnimationFrame(r));

        try {
            if (typeof html2canvas === 'undefined') {
                throw new Error('html2canvas 库未加载，请刷新页面后重试');
            }

            const canvas = await html2canvas(content, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#fffef5',
                logging: false
            });

            // 转成 PNG 并触发下载
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            const datePart = new Date().toLocaleDateString('zh-CN').replace(/\//g, '-');
            link.download = `周易占卜_${hexagramData.main.name}_${datePart}.png`;
            link.href = dataUrl;
            link.click();

        } catch (error) {
            console.error('截图导出失败 - 类型:', error.name);
            console.error('截图导出失败 - 信息:', error.message);
            console.error('截图导出失败 - 堆栈:', error.stack);
            alert(`截图导出失败：${error.message || error}`);
        } finally {
            document.body.removeChild(wrapper);
            this.isExporting = false;
        }
    }
}

window.PngExportModule = PngExportModule;
