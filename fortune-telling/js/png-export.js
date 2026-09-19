/**
 * 长截图导出模块 - 将卦象和解读导出为 PNG 长图
 * ================================================
 */

class PngExportModule {
    constructor() {
        this.isExporting = false;
    }

    escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    yaoStackHtml(yaoResults) {
        return [...(yaoResults || [])].reverse().map((yao) => {
            const isMoving = yao.moving;
            const isYang = yao.type === 'yang';
            const outline = yao.wasMoving ? 'outline:1px dashed rgba(196,30,58,0.4);outline-offset:2px;' : '';
            if (isYang) {
                const color = isMoving ? '#c41e3a' : '#d4af37';
                return `<div style="width:72px;height:10px;background:${color};margin:5px 0;border-radius:2px;${outline}"></div>`;
            }
            const color = isMoving ? '#e67e22' : '#8aa8d8';
            return `<div style="display:flex;gap:10px;margin:5px 0;${outline}">
                <div style="width:30px;height:10px;background:${color};border-radius:2px;"></div>
                <div style="width:30px;height:10px;background:${color};border-radius:2px;"></div>
            </div>`;
        }).join('');
    }

    yaoListHtml(yaoResults) {
        const names = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];
        return (yaoResults || []).map((yao, i) => {
            const typeText = yao.type === 'yang' ? '阳' : '阴';
            const badge = yao.moving
                ? `<span style="display:inline-block;background:#c41e3a;color:#fff;font-size:10px;padding:0 5px;border-radius:3px;margin-left:6px;">动</span>`
                : (yao.wasMoving
                    ? `<span style="display:inline-block;background:#c41e3a66;color:#fff;font-size:10px;padding:0 5px;border-radius:3px;margin-left:6px;">变</span>`
                    : '');
            const color = yao.moving ? '#c41e3a' : '#555';
            return `<div style="display:flex;justify-content:space-between;margin:4px 0;font-size:12px;color:${color};">
                <span>${names[i]}</span><span>${typeText}${badge}</span>
            </div>`;
        }).join('');
    }

    changedYaoResults(yaoResults) {
        return (yaoResults || []).map((yao) => ({
            type: yao.moving ? (yao.type === 'yang' ? 'yin' : 'yang') : yao.type,
            moving: false,
            wasMoving: !!yao.moving
        }));
    }

    hexColumnHtml(hex, yaoResults, kicker, hint) {
        const name = this.escapeHtml(hex && hex.name);
        const trigram = this.escapeHtml(hex && (hex.trigramText || hex.symbol || ''));
        const nature = this.escapeHtml(hex && hex.nature);
        return `
            <div style="text-align:center;padding:8px 10px;">
                <div style="font-size:12px;letter-spacing:2px;color:#c41e3a;margin-bottom:12px;">${this.escapeHtml(kicker)} · ${this.escapeHtml(hint)}</div>
                <div style="display:flex;flex-direction:column;align-items:center;margin-bottom:10px;">${this.yaoStackHtml(yaoResults)}</div>
                <div style="font-size:24px;color:#c41e3a;margin:0 0 6px;">${name}</div>
                ${trigram ? `<div style="font-size:13px;color:#777;margin-bottom:6px;">${trigram}</div>` : ''}
                ${nature ? `<div style="font-size:13px;color:#888;font-style:italic;margin-bottom:10px;">「${nature}」</div>` : ''}
                <div style="max-width:168px;margin:0 auto;text-align:left;">${this.yaoListHtml(yaoResults)}</div>
            </div>
        `;
    }

    emphasizeGanzhiLabel(html) {
        return String(html || '').replace(/起卦日辰/g, (match, offset, src) => {
            const before = src.slice(0, offset);
            if (before.lastIndexOf('<strong') > before.lastIndexOf('</strong>')) return match;
            const lt = before.lastIndexOf('<');
            const gt = before.lastIndexOf('>');
            if (lt > gt) return match;
            return '<strong>起卦日辰</strong>';
        });
    }

    parseMarkdown(text) {
        const html = typeof marked !== 'undefined'
            ? (marked.setOptions({ breaks: true, gfm: true }), marked.parse(text || ''))
            : this.escapeHtml(text).replace(/\n/g, '<br>');
        return this.emphasizeGanzhiLabel(html);
    }

    captureScale() {
        return Math.max(3, Math.ceil(window.devicePixelRatio || 1) + 1);
    }

    async waitForFonts() {
        if (document.fonts && document.fonts.ready) {
            try { await document.fonts.ready; } catch (e) { /* ignore */ }
        }
    }

    generateExportHtml(hexagramData, userQuestion, interpretation, followUps) {
        const now = new Date();
        const dateStr = now.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        const g = hexagramData.ganzhi || {};
        const mainCol = this.hexColumnHtml(hexagramData.main, hexagramData.yaoResults || [], '本卦', '当前处境');
        const changedCol = hexagramData.changed
            ? this.hexColumnHtml(hexagramData.changed, this.changedYaoResults(hexagramData.yaoResults), '变卦', '变化趋向')
            : `<div style="display:flex;align-items:center;justify-content:center;padding:24px 16px;color:#777;font-size:14px;line-height:1.7;">六爻安静，事态未起变。先把本卦当作当前处境来看。</div>`;
        const legend = hexagramData.changed
            ? '本卦看处境 · 动爻看转折 · 变卦看趋向'
            : '本卦看处境 · 六爻安静，先守住当下';

        const followUpHtml = (followUps || []).map((item) => {
            const label = item.role === 'assistant' ? '补解' : '追问';
            const body = item.role === 'assistant' ? this.parseMarkdown(item.content) : this.escapeHtml(item.content);
            const bg = item.role === 'assistant' ? 'rgba(212,175,55,0.08)' : 'rgba(196,30,58,0.06)';
            return `<div style="margin-top:14px;padding:14px 16px;border-radius:10px;background:${bg};">
                <div style="font-size:12px;letter-spacing:2px;color:#c41e3a;margin-bottom:8px;">${label}</div>
                <div style="font-size:14px;line-height:1.7;color:#2c2c2c;">${body}</div>
            </div>`;
        }).join('');

        return `
            <div id="screenshot-content" style="
                font-family: 'Noto Serif SC', 'SimSun', serif;
                padding: 48px 40px;
                background: linear-gradient(180deg, #fffef5 0%, #f5f0e1 100%);
                color: #2c2c2c;
                width: 720px;
                box-sizing: border-box;
            ">
                <div style="height:4px;background:#c41e3a;border-radius:2px;margin-bottom:28px;"></div>
                <div style="text-align:center;margin-bottom:24px;">
                    <div style="font-size:13px;color:#aaa;letter-spacing:3px;margin-bottom:8px;">周易六爻 · 铜钱占卜</div>
                    <h1 style="font-size:30px;color:#c41e3a;margin:0 0 8px 0;letter-spacing:8px;">卦象解读</h1>
                    <p style="color:#999;font-size:13px;margin:0;">占卜时间：${dateStr}</p>
                </div>

                <div style="display:flex;flex-wrap:wrap;gap:8px 14px;align-items:baseline;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid rgba(196,30,58,0.12);font-size:14px;">
                    <span style="color:#c41e3a;font-weight:600;font-size:12px;letter-spacing:2px;">起卦日辰</span>
                    <span>${this.escapeHtml(g.year || '—')}年</span>
                    <span>${this.escapeHtml(g.month || '—')}月</span>
                    <span>${this.escapeHtml(g.day || '—')}日</span>
                    <span>${this.escapeHtml(g.hour || '—')}时</span>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:8px;border:1px solid rgba(212,175,55,0.28);border-radius:10px;background:rgba(255,255,255,0.55);">
                    ${mainCol}
                    ${changedCol}
                </div>
                <p style="text-align:center;font-size:13px;color:#777;letter-spacing:1px;margin:8px 0 22px;">${legend}</p>

                <div style="padding-bottom:14px;margin-bottom:14px;border-bottom:1px solid rgba(196,30,58,0.18);font-size:16px;line-height:1.7;">
                    <span style="color:#c41e3a;font-weight:600;">所问之事：</span>
                    <span>${this.escapeHtml(userQuestion)}</span>
                </div>

                <div style="line-height:1.8;font-size:15px;">
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
                    ${this.parseMarkdown(interpretation)}
                    ${followUpHtml}
                </div>

                <div style="text-align:center;margin-top:28px;color:#bbb;font-size:12px;">
                    <div style="height:1px;background:#d4af37;margin-bottom:16px;"></div>
                    <p style="margin:0;">卦象仅供参考，命运掌握在自己手中</p>
                </div>
            </div>
        `;
    }

    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
            || window.innerWidth <= 768;
    }

    canvasToBlob(canvas, type = 'image/png') {
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                if (blob) resolve(blob);
                else reject(new Error('Canvas 转 Blob 失败'));
            }, type);
        });
    }

    async saveMobile(canvas, fileName) {
        const blob = await this.canvasToBlob(canvas);
        const file = new File([blob], fileName, { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: '卦象解读',
                    text: '周易六爻铜钱占卜结果'
                });
                return;
            } catch (e) {
                if (e.name === 'AbortError') return;
            }
        }

        const url = URL.createObjectURL(blob);
        const preview = window.open('');
        if (preview) {
            preview.document.write(`
                <html><head><meta name="viewport" content="width=device-width,initial-scale=1">
                <title>长按图片保存</title>
                <style>body{margin:0;display:flex;flex-direction:column;align-items:center;background:#f5f5f5;padding:16px;}
                img{max-width:100%;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.15);}
                .tip{margin:16px 0;padding:10px 20px;background:#c41e3a;color:#fff;border-radius:20px;font-size:14px;}</style></head>
                <body><div class="tip">长按图片即可保存到相册</div><img src="${url}"></body></html>
            `);
            preview.document.close();
        } else {
            this.showInlinePreview(url);
        }
    }

    showInlinePreview(blobUrl) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.8);display:flex;flex-direction:column;align-items:center;overflow-y:auto;padding:20px;';
        overlay.innerHTML = `
            <div style="color:#fff;font-size:14px;margin-bottom:12px;padding:8px 16px;background:#c41e3a;border-radius:20px;">长按图片保存到相册</div>
            <img src="${blobUrl}" style="max-width:100%;border-radius:8px;">
            <button style="margin:16px 0;padding:10px 30px;background:#fff;border:none;border-radius:20px;font-size:14px;cursor:pointer;">关闭</button>
        `;
        overlay.querySelector('button').onclick = () => {
            URL.revokeObjectURL(blobUrl);
            overlay.remove();
        };
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                URL.revokeObjectURL(blobUrl);
                overlay.remove();
            }
        });
        document.body.appendChild(overlay);
    }

    saveDesktop(canvas, fileName) {
        const url = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = fileName;
        link.href = url;
        link.click();
    }

    async exportToPng(hexagramData, userQuestion, interpretation, followUps) {
        if (this.isExporting) return;
        this.isExporting = true;

        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position:fixed;left:-10000px;top:0;width:720px;z-index:-1;';
        wrapper.innerHTML = this.generateExportHtml(hexagramData, userQuestion, interpretation, followUps);
        document.body.appendChild(wrapper);

        const content = wrapper.querySelector('#screenshot-content');
        await this.waitForFonts();
        await new Promise(r => requestAnimationFrame(r));

        try {
            if (typeof html2canvas === 'undefined') {
                throw new Error('html2canvas 库未加载，请刷新页面后重试');
            }

            const canvas = await html2canvas(content, {
                scale: this.captureScale(),
                useCORS: true,
                backgroundColor: '#fffef5',
                logging: false,
                letterRendering: true,
                width: 720,
                windowWidth: 720
            });

            const datePart = new Date().toLocaleDateString('zh-CN').replace(/\//g, '-');
            const fileName = `周易占卜_${hexagramData.main.name}_${datePart}.png`;

            if (this.isMobile()) {
                await this.saveMobile(canvas, fileName);
            } else {
                this.saveDesktop(canvas, fileName);
            }

        } catch (error) {
            console.error('截图导出失败:', error);
            alert(`截图导出失败：${error.message || error}`);
        } finally {
            document.body.removeChild(wrapper);
            this.isExporting = false;
        }
    }
}

window.PngExportModule = PngExportModule;
