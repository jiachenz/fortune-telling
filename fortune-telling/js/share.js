/**
 * 分享模块 - 把网站/成就/邀请分享给朋友
 * ================================================
 * 能力：
 *   1. 系统分享（移动端 Web Share API）
 *   2. 复制链接 / 复制文案（桌面端 & 微信内置浏览器回退）
 *   3. 二维码 + 生成分享图（模板化，支持多种卡片）
 *
 * 卡片模板（cardType）：
 *   - brand  ：品牌卡（含每日一易），可公开晒，不含个人隐私
 *   - streak ：打卡成就卡「连续观易 X 天」，可公开晒
 *   - result ：结果卡（卦象符号 + 卦名 + 一句指引），偏私密（一对一）
 *   - invite ：替朋友求一卦邀请卡「给 XX 的卦 · 关于事业」，私密（一对一）
 *
 * 分享链接统一带 ?ref= 便于计算扫码/点击转化。
 */

class ShareModule {
    constructor() {
        this.title = '周易六爻 · 铜钱占卜';
        this.slogan = '知几而决';
        this.description = '看见变化，理清处境，做出更清醒的选择';
        this.isGeneratingCard = false;
        this.el = {};
        this._contextUrl = null;
        this._cardType = 'brand';
        this._cardData = {};
    }

    // ---------- URL ----------

    _baseUrl() {
        if (location.protocol === 'http:' || location.protocol === 'https:') {
            return location.origin + location.pathname.replace(/index\.html$/, '');
        }
        return 'https://fortune-telling-liuyao.netlify.app/';
    }

    /**
     * 基于站点地址拼接分享参数（ref / for / topic 等）
     */
    buildShareUrl(params = {}) {
        try {
            const url = new URL(this._baseUrl());
            Object.entries(params).forEach(([k, v]) => {
                if (v !== null && v !== undefined && v !== '') url.searchParams.set(k, v);
            });
            return url.toString();
        } catch (e) {
            return this._baseUrl();
        }
    }

    getShareUrl() {
        return this._contextUrl || this.buildShareUrl();
    }

    // ---------- 初始化 ----------

    init() {
        this.el = {
            modal: document.getElementById('share-modal'),
            closeBtn: document.getElementById('share-modal-close'),
            title: document.getElementById('share-modal-title'),
            hint: document.getElementById('share-modal-hint'),
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

        if (!this.canSystemShare()) {
            this.el.systemBtn.style.display = 'none';
        }
    }

    canSystemShare() {
        return typeof navigator.share === 'function';
    }

    _track(name, extra) {
        if (window.Analytics) window.Analytics.track(name, extra || {});
    }

    /**
     * 打开分享弹窗
     * @param {object} opts { cardType, url, ref, cardData, title, hint, cardBtnLabel }
     */
    open(opts = {}) {
        this._cardType = opts.cardType || 'brand';
        this._cardData = opts.cardData || {};
        this._contextUrl = opts.url || this.buildShareUrl({ ref: opts.ref || this._cardType });

        if (this.el.title) this.el.title.textContent = opts.title || '分享给朋友';
        if (this.el.hint) this.el.hint.textContent = opts.hint || '觉得好用，转给需要的人 · 知几而决';
        if (this.el.cardBtn) {
            this.el.cardBtn.textContent = opts.cardBtnLabel || '生成分享图';
        }

        const url = this.getShareUrl();
        if (this.el.linkInput) this.el.linkInput.value = url;
        this.renderQr(url);

        if (this.el.modal) this.el.modal.classList.add('active');
        this._track('share_open', { cardType: this._cardType });
    }

    close() {
        if (this.el.modal) this.el.modal.classList.remove('active');
    }

    // ---------- 二维码 ----------

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

    // ---------- 分享动作 ----------

    async systemShare() {
        const url = this.getShareUrl();
        this._track('share_click', { cardType: this._cardType });
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

    async copyText(text, successMsg) {
        let ok = false;
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                ok = true;
            }
        } catch (e) { ok = false; }

        if (!ok && this.el.linkInput) {
            try {
                const prev = this.el.linkInput.value;
                this.el.linkInput.value = text;
                this.el.linkInput.focus();
                this.el.linkInput.select();
                ok = document.execCommand('copy');
                window.getSelection().removeAllRanges();
                this.el.linkInput.value = prev;
            } catch (e) { ok = false; }
        }

        this.toast(ok ? (successMsg || '已复制') : '复制失败，请手动长按复制');
        return ok;
    }

    async copyLink() {
        this._track('share_click', { cardType: this._cardType });
        await this.copyText(this.getShareUrl(), '链接已复制，去微信粘贴给好友吧');
    }

    // ---------- 生成分享图 ----------

    async generateCard() {
        if (this.isGeneratingCard) return;
        this.isGeneratingCard = true;

        const btn = this.el.cardBtn;
        const originalText = btn ? btn.textContent : '';
        if (btn) { btn.textContent = '生成中...'; btn.disabled = true; }

        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:600px;z-index:-1;';
        wrapper.innerHTML = this.buildCardHtml(this._cardType, this._cardData);
        document.body.appendChild(wrapper);

        const content = wrapper.querySelector('#share-card-content');
        const qrSlot = wrapper.querySelector('#share-card-qr-slot');

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

            this.compositeQr(canvas, content, qrSlot);

            const fileName = `周易六爻_${this._cardType}.png`;
            this._track('card_generated', { cardType: this._cardType });
            this._track('share_click', { cardType: this._cardType });

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
     * 把二维码画到 html2canvas 截图结果上（避开 html2canvas 对 canvas/img 的兼容问题）
     */
    compositeQr(targetCanvas, content, slot) {
        if (!slot || typeof qrcode === 'undefined') return;
        try {
            const cRect = content.getBoundingClientRect();
            const sRect = slot.getBoundingClientRect();
            const scaleX = targetCanvas.width / cRect.width;
            const scaleY = targetCanvas.height / cRect.height;
            const x = (sRect.left - cRect.left) * scaleX;
            const y = (sRect.top - cRect.top) * scaleY;
            const w = sRect.width * scaleX;
            const h = sRect.height * scaleY;

            const qrCanvas = this.makeQrCanvas(this.getShareUrl(), Math.round(Math.min(w, h)));
            const ctx = targetCanvas.getContext('2d');
            // 复位上下文：html2canvas 渲染后可能残留 globalAlpha=0 / 变换，导致后续绘制不可见
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

    // ---------- 每日一易 ----------

    getDailyTip() {
        try {
            if (window.dailyTipsModule && typeof window.dailyTipsModule.getTodayTip === 'function') {
                return window.dailyTipsModule.getTodayTip();
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    dailyTipHtml() {
        const tip = this.getDailyTip();
        if (!tip) return '';
        return `
            <div style="text-align:left;background:#fff8e7;border-left:4px solid #d4af37;border-radius:0 10px 10px 0;padding:16px 18px;margin:0 0 30px;">
                <div style="font-size:12px;color:#c41e3a;letter-spacing:2px;margin-bottom:10px;">每日一易 · ${tip.theme}</div>
                <div style="font-size:17px;color:#2c2c2c;line-height:1.7;">“${tip.quote}”</div>
                <div style="font-size:12px;color:#999;text-align:right;margin-top:6px;">—— ${tip.source}</div>
                <div style="font-size:13px;color:#666;line-height:1.7;margin-top:12px;">${tip.explanation}</div>
            </div>
        `;
    }

    // ---------- 卡片模板 ----------

    escapeHtml(str) {
        return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    /**
     * 卡片外壳：统一宽度/背景/顶部装饰/底部标语 + 二维码槽位
     */
    _cardShell(innerHtml, footerText) {
        const url = this.getShareUrl();
        return `
            <div id="share-card-content" style="
                font-family:'Noto Serif SC','SimSun',serif;
                width:600px;box-sizing:border-box;padding:56px 48px;
                background:linear-gradient(160deg,#fffef5 0%,#fbf3df 100%);
                color:#2c2c2c;text-align:center;">
                <div style="height:4px;width:64px;background:#c41e3a;border-radius:2px;margin:0 auto 32px;"></div>
                ${innerHtml}
                <div style="display:inline-block;padding:20px;background:#fff;border-radius:16px;box-shadow:0 6px 20px rgba(0,0,0,0.08);border:1px solid rgba(212,175,55,0.35);">
                    <div id="share-card-qr-slot" style="width:180px;height:180px;margin:0 auto;"></div>
                </div>
                <p style="font-size:14px;color:#c41e3a;margin:18px 0 4px;font-weight:600;">微信扫一扫 · 长按识别</p>
                <p style="font-size:12px;color:#aaa;margin:0;word-break:break-all;">${this.escapeHtml(url)}</p>
                <div style="height:1px;background:#d4af37;opacity:0.5;margin:36px 0 16px;"></div>
                <p style="font-size:12px;color:#bbb;margin:0;">${footerText || '免费在线摇卦 · AI 智能解卦 · 卦象仅供参考'}</p>
            </div>
        `;
    }

    buildCardHtml(type, data = {}) {
        switch (type) {
            case 'streak': return this._cardStreak(data);
            case 'invite': return this._cardInvite(data);
            case 'result': return this._cardResult(data);
            case 'brand':
            default: return this._cardBrand();
        }
    }

    _cardBrand() {
        const inner = `
            <div style="font-size:72px;line-height:1;color:#c41e3a;margin-bottom:16px;">☯</div>
            <h1 style="font-size:40px;letter-spacing:10px;color:#c41e3a;margin:0 0 12px;">周易六爻</h1>
            <p style="font-size:20px;letter-spacing:6px;color:#d4af37;margin:0 0 8px;">知 · 几 · 而 · 决</p>
            <p style="font-size:15px;color:#777;margin:0 0 30px;line-height:1.8;">${this.description}</p>
            ${this.dailyTipHtml()}
        `;
        return this._cardShell(inner);
    }

    _cardStreak(data) {
        const days = Number(data.streak) || 0;
        const label = data.milestone
            ? `已连续观易 ${days} 天 · 解锁「${data.milestoneName || days + '天'}」`
            : `已连续观易 ${days} 天`;
        const inner = `
            <div style="font-size:64px;line-height:1;margin-bottom:8px;">🔥</div>
            <p style="font-size:16px;letter-spacing:4px;color:#d4af37;margin:0 0 6px;">观 易 打 卡</p>
            <div style="font-size:88px;font-weight:700;color:#c41e3a;line-height:1;margin:8px 0;">${days}</div>
            <p style="font-size:20px;color:#2c2c2c;margin:0 0 8px;">${this.escapeHtml(label)}</p>
            <p style="font-size:14px;color:#888;margin:0 0 30px;line-height:1.8;">日省一卦，知几而决</p>
        `;
        return this._cardShell(inner, '连续观易 · 日日精进 · 与我一起知几而决');
    }

    _cardInvite(data) {
        const name = this.escapeHtml(data.name || '你');
        const topic = this.escapeHtml(data.topic || '');
        const topicLine = topic ? `关于「${topic}」` : '一桩心事';
        const inner = `
            <div style="font-size:60px;line-height:1;color:#c41e3a;margin-bottom:12px;">☯</div>
            <p style="font-size:15px;letter-spacing:3px;color:#d4af37;margin:0 0 14px;">有人为你求了一卦</p>
            <h1 style="font-size:34px;color:#c41e3a;margin:0 0 10px;">给 ${name} 的卦</h1>
            <p style="font-size:17px;color:#2c2c2c;margin:0 0 8px;">${topicLine}</p>
            <p style="font-size:14px;color:#888;margin:0 0 30px;line-height:1.8;">扫码亲自摇一卦，看看天机如何指引</p>
        `;
        return this._cardShell(inner, '心诚则灵 · 亲自起卦 · 卦象仅供参考');
    }

    _cardResult(data) {
        const symbol = this.escapeHtml(data.symbol || '☯');
        const name = this.escapeHtml(data.name || '');
        const changed = data.changedName ? ` → ${this.escapeHtml(data.changedName)}` : '';
        const question = data.question ? this.escapeHtml(data.question) : '';
        const advice = data.advice ? this.escapeHtml(data.advice) : '';
        const inner = `
            <div style="font-size:56px;letter-spacing:6px;line-height:1;color:#c41e3a;margin-bottom:14px;">${symbol}</div>
            <h1 style="font-size:32px;color:#c41e3a;margin:0 0 10px;">${name}${changed}</h1>
            ${question ? `<p style="font-size:15px;color:#777;margin:0 0 16px;">所问：${question}</p>` : ''}
            ${advice ? `<div style="text-align:left;background:#fff8e7;border-left:4px solid #d4af37;border-radius:0 10px 10px 0;padding:16px 18px;margin:0 0 30px;font-size:14px;color:#555;line-height:1.8;">${advice}</div>` : '<div style="margin-bottom:20px;"></div>'}
        `;
        return this._cardShell(inner, '扫码亲测你的一卦 · 卦象仅供参考');
    }

    // ---------- 图片保存工具 ----------

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
