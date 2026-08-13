/**
 * 分享模块 - 把网站分享给朋友
 * ================================================
 * 提供三种能力：
 *   1. 系统分享（移动端 Web Share API）
 *   2. 复制链接（桌面端 / 微信内置浏览器回退）
 *   3. 二维码 + 生成品牌推广图（适合微信聊天里发给好友）
 *
 * 注意：推广图默认「只推广网站本身」，不包含用户的问题与卦象结果，
 * 以免转发时泄露个人占卜内容（运势偏私密）。
 */

class ShareModule {
    constructor() {
        this.title = '周易六爻 · 铜钱占卜';
        this.slogan = '知几而决';
        this.description = '看见变化，理清处境，做出更清醒的选择';
        this.isGeneratingCard = false;
        this.el = {};
    }

    /**
     * 计算要分享的网站地址：
     * - 线上（http/https）：用当前域名，部署到哪就指到哪
     * - 本地文件预览（file://）：回退到占位域名，提醒替换
     */
    getShareUrl() {
        if (location.protocol === 'http:' || location.protocol === 'https:') {
            return location.origin + location.pathname.replace(/index\.html$/, '');
        }
        return 'https://fortune-telling-liuyao.netlify.app/';
    }

    init() {
        this.el = {
            modal: document.getElementById('share-modal'),
            closeBtn: document.getElementById('share-modal-close'),
            qr: document.getElementById('share-qr'),
            linkInput: document.getElementById('share-link-input'),
            copyBtn: document.getElementById('share-copy-btn'),
            systemBtn: document.getElementById('share-system-btn'),
            cardBtn: document.getElementById('share-card-btn')
        };

        if (!this.el.modal) return;

        this.el.closeBtn.addEventListener('click', () => this.close());
        this.el.modal.addEventListener('click', (e) => {
            if (e.target === this.el.modal) this.close();
        });
        this.el.copyBtn.addEventListener('click', () => this.copyLink());
        this.el.systemBtn.addEventListener('click', () => this.systemShare());
        this.el.cardBtn.addEventListener('click', () => this.generateCard());

        // 桌面端没有系统分享面板，隐藏该按钮
        if (!this.canSystemShare()) {
            this.el.systemBtn.style.display = 'none';
        }
    }

    canSystemShare() {
        return typeof navigator.share === 'function';
    }

    /**
     * 打开分享弹窗：优先直接唤起系统分享面板（移动端体验最好），
     * 同时弹窗内保留复制链接 / 二维码 / 生成分享图等回退方式。
     */
    open() {
        const url = this.getShareUrl();
        if (this.el.linkInput) this.el.linkInput.value = url;
        this.renderQr(url);

        if (this.el.modal) this.el.modal.classList.add('active');
    }

    close() {
        if (this.el.modal) this.el.modal.classList.remove('active');
    }

    /**
     * 把二维码绘制到一个 canvas 元素（同步绘制，html2canvas 截图最稳）
     */
    makeQrCanvas(text, sizePx) {
        const qr = qrcode(0, 'M');
        qr.addData(text);
        qr.make();
        const count = qr.getModuleCount();
        const marginModules = 4;
        const totalModules = count + marginModules * 2;
        const cell = Math.max(1, Math.floor(sizePx / totalModules));
        const dim = cell * totalModules;

        const canvas = document.createElement('canvas');
        canvas.width = dim;
        canvas.height = dim;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, dim, dim);
        ctx.fillStyle = '#000000';
        for (let r = 0; r < count; r++) {
            for (let c = 0; c < count; c++) {
                if (qr.isDark(r, c)) {
                    ctx.fillRect((c + marginModules) * cell, (r + marginModules) * cell, cell, cell);
                }
            }
        }
        return canvas;
    }

    /**
     * 生成二维码并渲染到弹窗
     */
    renderQr(url) {
        if (!this.el.qr) return;
        this.el.qr.innerHTML = '';
        if (typeof qrcode === 'undefined') {
            this.el.qr.textContent = '二维码库未加载';
            return;
        }
        try {
            const canvas = this.makeQrCanvas(url, 160);
            canvas.style.width = '160px';
            canvas.style.height = '160px';
            this.el.qr.appendChild(canvas);
        } catch (e) {
            console.error('二维码生成失败:', e);
            this.el.qr.textContent = '二维码生成失败';
        }
    }

    /**
     * 系统分享（移动端）
     */
    async systemShare() {
        const url = this.getShareUrl();
        if (!this.canSystemShare()) {
            this.copyLink();
            return;
        }
        try {
            await navigator.share({
                title: this.title,
                text: `${this.title} · ${this.slogan}——${this.description}`,
                url
            });
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('系统分享失败:', e);
                this.copyLink();
            }
        }
    }

    /**
     * 复制链接到剪贴板
     */
    async copyLink() {
        const url = this.getShareUrl();
        let ok = false;
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(url);
                ok = true;
            }
        } catch (e) {
            ok = false;
        }

        if (!ok) {
            // 回退方案：选中输入框内容执行 execCommand
            try {
                this.el.linkInput.focus();
                this.el.linkInput.select();
                ok = document.execCommand('copy');
                window.getSelection().removeAllRanges();
            } catch (e) {
                ok = false;
            }
        }

        this.toast(ok ? '链接已复制，去微信粘贴给好友吧' : '复制失败，请手动长按复制链接');
    }

    /**
     * 生成品牌推广图（带二维码），保存 / 分享为图片
     */
    async generateCard() {
        if (this.isGeneratingCard) return;
        this.isGeneratingCard = true;

        const btn = this.el.cardBtn;
        const originalText = btn ? btn.textContent : '';
        if (btn) { btn.textContent = '生成中...'; btn.disabled = true; }

        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:600px;z-index:-1;';
        wrapper.innerHTML = this.generateCardHtml();
        document.body.appendChild(wrapper);

        const content = wrapper.querySelector('#share-card-content');
        const qrSlot = wrapper.querySelector('#share-card-qr-slot');

        await new Promise(r => requestAnimationFrame(r));

        try {
            if (typeof html2canvas === 'undefined') {
                throw new Error('html2canvas 库未加载，请刷新后重试');
            }
            const scale = 2;
            const canvas = await html2canvas(content, {
                scale,
                useCORS: true,
                backgroundColor: '#fffef5',
                logging: false
            });

            // 手动把二维码合成到截图上（不依赖 html2canvas 渲染 canvas/img）
            this.compositeQr(canvas, content, qrSlot);

            const fileName = `周易六爻_分享卡片.png`;
            if (this.isMobile()) {
                await this.saveMobile(canvas, fileName);
            } else {
                this.saveDesktop(canvas, fileName);
            }
        } catch (error) {
            console.error('分享图生成失败:', error);
            this.toast(`分享图生成失败：${error.message || error}`);
        } finally {
            document.body.removeChild(wrapper);
            this.isGeneratingCard = false;
            if (btn) { btn.textContent = originalText; btn.disabled = false; }
        }
    }

    /**
     * 把二维码直接画到 html2canvas 截图结果上（避开 html2canvas 对 canvas/img 的兼容问题）
     * @param {HTMLCanvasElement} targetCanvas html2canvas 的输出
     * @param {HTMLElement} content 卡片根节点（#share-card-content）
     * @param {HTMLElement} slot 二维码占位框（#share-card-qr-slot）
     * @param {number} scale html2canvas 使用的缩放
     */
    compositeQr(targetCanvas, content, slot) {
        if (!slot || typeof qrcode === 'undefined') return;
        try {
            const cRect = content.getBoundingClientRect();
            const sRect = slot.getBoundingClientRect();
            // 用输出画布的实际尺寸反推真实缩放，避免 html2canvas 未按 scale 输出时坐标错位
            const scaleX = targetCanvas.width / cRect.width;
            const scaleY = targetCanvas.height / cRect.height;
            const x = (sRect.left - cRect.left) * scaleX;
            const y = (sRect.top - cRect.top) * scaleY;
            const w = sRect.width * scaleX;
            const h = sRect.height * scaleY;

            const qrCanvas = this.makeQrCanvas(this.getShareUrl(), Math.round(Math.min(w, h)));
            const ctx = targetCanvas.getContext('2d');
            // 复位上下文状态：html2canvas 渲染后可能残留 globalAlpha=0 / 变换，导致后续绘制不可见
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
            const dx = x + (w - qrCanvas.width) / 2;
            const dy = y + (h - qrCanvas.height) / 2;
            ctx.drawImage(qrCanvas, dx, dy);
        } catch (e) {
            console.error('合成二维码失败:', e);
        }
    }

    /**
     * 安全读取「每日一易」当天内容（复用页面上的 dailyTipsModule）
     */
    getDailyTip() {
        try {
            if (window.dailyTipsModule && typeof window.dailyTipsModule.getTodayTip === 'function') {
                return window.dailyTipsModule.getTodayTip();
            }
        } catch (e) { /* 忽略，无每日一易时降级 */ }
        return null;
    }

    /**
     * 生成「每日一易」区块的 HTML（无数据时返回空串）
     */
    dailyTipHtml() {
        const tip = this.getDailyTip();
        if (!tip) return '';
        return `
            <div style="
                text-align:left;
                background:#fff8e7;
                border-left:4px solid #d4af37;
                border-radius:0 10px 10px 0;
                padding:16px 18px;
                margin:0 0 30px;
            ">
                <div style="font-size:12px;color:#c41e3a;letter-spacing:2px;margin-bottom:10px;">每日一易 · ${tip.theme}</div>
                <div style="font-size:17px;color:#2c2c2c;line-height:1.7;">“${tip.quote}”</div>
                <div style="font-size:12px;color:#999;text-align:right;margin-top:6px;">—— ${tip.source}</div>
                <div style="font-size:13px;color:#666;line-height:1.7;margin-top:12px;">${tip.explanation}</div>
            </div>
        `;
    }

    generateCardHtml() {
        const url = this.getShareUrl();

        return `
            <div id="share-card-content" style="
                font-family:'Noto Serif SC','SimSun',serif;
                width:600px;
                box-sizing:border-box;
                padding:56px 48px;
                background:linear-gradient(160deg,#fffef5 0%,#fbf3df 100%);
                color:#2c2c2c;
                text-align:center;
            ">
                <div style="height:4px;width:64px;background:#c41e3a;border-radius:2px;margin:0 auto 32px;"></div>

                <div style="font-size:72px;line-height:1;color:#c41e3a;margin-bottom:16px;">☯</div>
                <h1 style="font-size:40px;letter-spacing:10px;color:#c41e3a;margin:0 0 12px;">周易六爻</h1>
                <p style="font-size:20px;letter-spacing:6px;color:#d4af37;margin:0 0 8px;">知 · 几 · 而 · 决</p>
                <p style="font-size:15px;color:#777;margin:0 0 30px;line-height:1.8;">${this.description}</p>

                ${this.dailyTipHtml()}

                <div style="
                    display:inline-block;
                    padding:20px;
                    background:#fff;
                    border-radius:16px;
                    box-shadow:0 6px 20px rgba(0,0,0,0.08);
                    border:1px solid rgba(212,175,55,0.35);
                ">
                    <div id="share-card-qr-slot" style="width:180px;height:180px;margin:0 auto;"></div>
                </div>
                <p style="font-size:14px;color:#c41e3a;margin:18px 0 4px;font-weight:600;">微信扫一扫 · 长按识别</p>
                <p style="font-size:12px;color:#aaa;margin:0;word-break:break-all;">${url}</p>

                <div style="height:1px;background:#d4af37;opacity:0.5;margin:36px 0 16px;"></div>
                <p style="font-size:12px;color:#bbb;margin:0;">免费在线摇卦 · AI 智能解卦 · 卦象仅供参考</p>
            </div>
        `;
    }

    // ---------- 图片保存工具（与 png-export 保持一致的体验）----------

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
                    title: this.title,
                    text: `${this.title} · ${this.slogan}`
                });
                return;
            } catch (e) {
                if (e.name === 'AbortError') return;
            }
        }

        const objUrl = URL.createObjectURL(blob);
        const preview = window.open('');
        if (preview) {
            preview.document.write(`
                <html><head><meta name="viewport" content="width=device-width,initial-scale=1">
                <title>长按图片保存</title>
                <style>body{margin:0;display:flex;flex-direction:column;align-items:center;background:#f5f5f5;padding:16px;}
                img{max-width:100%;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.15);}
                .tip{margin:16px 0;padding:10px 20px;background:#c41e3a;color:#fff;border-radius:20px;font-size:14px;}</style></head>
                <body><div class="tip">长按图片保存后发给好友</div><img src="${objUrl}"></body></html>
            `);
            preview.document.close();
        } else {
            this.showInlinePreview(objUrl);
        }
    }

    showInlinePreview(blobUrl) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.8);display:flex;flex-direction:column;align-items:center;overflow-y:auto;padding:20px;';
        overlay.innerHTML = `
            <div style="color:#fff;font-size:14px;margin-bottom:12px;padding:8px 16px;background:#c41e3a;border-radius:20px;">长按图片保存后发给好友</div>
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
        this.toast('分享图已保存，可发给好友');
    }

    // ---------- 轻提示 ----------

    toast(message) {
        let toast = document.getElementById('share-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'share-toast';
            toast.className = 'share-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('show');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
    }
}

window.ShareModule = ShareModule;
