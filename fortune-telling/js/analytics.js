/**
 * 轻量埋点助手
 * ================================================
 * fire-and-forget 上报关键事件到 /api/track（线上走 Netlify Function + Blobs，
 * 本地走 express 文件存储）。任何失败都静默，绝不影响用户交互。
 *
 * 事件：result_view / share_open / share_click / card_generated / landing
 */

const Analytics = {
    _ref: null,

    /**
     * 读取分享链接带来的来源标记 ?ref=，用于计算转化
     */
    initRef() {
        try {
            const params = new URLSearchParams(location.search);
            this._ref = params.get('ref');
        } catch (e) {
            this._ref = null;
        }
        return this._ref;
    },

    getRef() {
        if (this._ref === null) this.initRef();
        return this._ref;
    },

    getDeviceId() {
        try {
            if (window.appStorage && typeof window.appStorage.getDeviceId === 'function') {
                return window.appStorage.getDeviceId();
            }
        } catch (e) { /* ignore */ }
        return null;
    },

    /**
     * 上报事件
     * @param {string} name 事件名
     * @param {object} extra { cardType, ref }
     */
    track(name, extra = {}) {
        try {
            const payload = {
                event: name,
                cardType: extra.cardType || undefined,
                ref: extra.ref || this.getRef() || undefined,
                deviceId: this.getDeviceId() || undefined
            };
            const body = JSON.stringify(payload);

            // 优先 sendBeacon（页面卸载也能发出），回退 fetch keepalive
            if (navigator.sendBeacon) {
                const blob = new Blob([body], { type: 'application/json' });
                navigator.sendBeacon('/api/track', blob);
            } else {
                fetch('/api/track', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body,
                    keepalive: true
                }).catch(() => {});
            }
        } catch (e) {
            // 埋点失败绝不影响体验
        }
    },

    /**
     * 若本次访问来自分享链接（带 ?ref=），记一次落地
     */
    trackLandingIfReferred() {
        const ref = this.getRef();
        if (ref) this.track('landing', { ref });
    }
};

window.Analytics = Analytics;
