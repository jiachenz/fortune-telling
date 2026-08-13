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
        this.qrDataUrl = '';
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
        return 'https://REPLACE_WITH_YOUR_DOMAIN/';
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
     * 生成二维码并渲染到弹窗，同时缓存 dataURL 供推广图复用
     */
    renderQr(url) {
        this.qrDataUrl = '';
        if (typeof qrcode === 'undefined') {
            if (this.el.qr) this.el.qr.textContent = '二维码库未加载';
            return;
        }
        try {
            const qr = qrcode(0, 'M');
            qr.addData(url);
            qr.make();
            this.qrDataUrl = qr.createDataURL(6, 12);
            if (this.el.qr) {
                this.el.qr.innerHTML = `<img src="${this.qrDataUrl}" alt="网站二维码" width="160" height="160">`;
            }
        } catch (e) {
            console.error('二维码生成失败:', e);
            if (this.el.qr) this.el.qr.textContent = '二维码生成失败';
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
        await new Promise(r => requestAnimationFrame(r));

        try {
            if (typeof html2canvas === 'undefined') {
                throw new Error('html2canvas 库未加载，请刷新后重试');
            }
            const canvas = await html2canvas(content, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#fffef5',
                logging: false
            });
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
        const qrImg = this.qrDataUrl
            ? `<img src="${this.qrDataUrl}" alt="二维码" style="width:180px;height:180px;display:block;">`
            : `<div style="width:180px;height:180px;display:flex;align-items:center;justify-content:center;color:#999;font-size:13px;">二维码</div>`;

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
                    ${qrImg}
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
