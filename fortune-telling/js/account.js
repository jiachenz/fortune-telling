/**
 * 账号模块：邮箱验证码登录、「我的」面板、兑换码、邀请好友、卦历
 * ================================================
 * 会话在 HttpOnly Cookie 里，前端只通过 /api/account 读状态
 */

class AccountModule {
    constructor() {
        this.me = null;
        this.available = false;
        this.REFERRAL_KEY = 'fortune_referral';
        this.callbacks = {};
        this.el = {};
        this._cooldownTimer = null;
    }

    init(callbacks) {
        this.callbacks = callbacks || {};
        const $ = (id) => document.getElementById(id);
        this.el = {
            btn: $('account-btn'),
            btnLabel: $('account-btn-label'),
            modal: $('account-modal'),
            loginView: $('account-login-view'),
            profileView: $('account-profile-view'),
            referralHint: $('account-referral-hint'),
            email: $('account-email'),
            codeGroup: $('account-code-group'),
            code: $('account-code'),
            loginMsg: $('account-login-msg'),
            sendBtn: $('account-send-btn'),
            verifyBtn: $('account-verify-btn'),
            emailDisplay: $('account-email-display'),
            tier: $('account-tier'),
            usage: $('account-usage'),
            redeemInput: $('redeem-input'),
            redeemBtn: $('redeem-btn'),
            redeemMsg: $('redeem-msg'),
            referralDesc: $('referral-desc'),
            referralLink: $('referral-link-input'),
            referralCopy: $('referral-link-copy'),
            historyBtn: $('history-open-btn'),
            logoutBtn: $('account-logout-btn'),
            historyModal: $('history-modal'),
            historyList: $('history-list')
        };
        this.captureReferral();
        this.bind();
    }

    // ------------------------------------------
    // 接口
    // ------------------------------------------

    async call(action, payload) {
        const res = await fetch('/api/account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(Object.assign({
                action,
                deviceId: window.appStorage ? window.appStorage.getDeviceId() : null
            }, payload || {}))
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = new Error(data.error || `请求失败：${res.status}`);
            err.status = res.status;
            throw err;
        }
        return data;
    }

    async refresh() {
        try {
            this.me = await this.call('me');
            this.available = true;
        } catch (e) {
            this.me = null;
            this.available = false;
        }
        this.renderButton();
        if (this.isOpen() && this.loggedIn()) this.renderProfile();
        if (this.callbacks.onChange) this.callbacks.onChange(this.me);
        return this.me;
    }

    loggedIn() {
        return !!(this.me && this.me.loggedIn);
    }

    limits() {
        const l = this.me && this.me.limits;
        return l && l.enabled ? l : null;
    }

    // ------------------------------------------
    // 邀请码
    // ------------------------------------------

    captureReferral() {
        try {
            const code = new URLSearchParams(location.search).get('inv');
            if (code && /^[A-Za-z0-9]{4,12}$/.test(code)) localStorage.setItem(this.REFERRAL_KEY, code.toUpperCase());
        } catch (e) { /* ignore */ }
    }

    pendingReferral() {
        try { return localStorage.getItem(this.REFERRAL_KEY) || ''; } catch (e) { return ''; }
    }

    referralUrl() {
        if (!this.me || !this.me.referralCode) return '';
        return `${location.origin}/?inv=${this.me.referralCode}`;
    }

    // ------------------------------------------
    // 弹窗
    // ------------------------------------------

    isOpen() {
        return !!(this.el.modal && this.el.modal.classList.contains('active'));
    }

    open() {
        if (!this.el.modal) return;
        if (this.loggedIn()) {
            this.el.loginView.hidden = true;
            this.el.profileView.hidden = false;
            this.renderProfile();
            this.refresh();
        } else {
            this.el.profileView.hidden = true;
            this.el.loginView.hidden = false;
            this.el.referralHint.hidden = !this.pendingReferral();
            this.setMsg(this.el.loginMsg, '');
        }
        this.el.modal.classList.add('active');
        if (!this.loggedIn() && this.el.email) setTimeout(() => this.el.email.focus(), 50);
    }

    close() {
        if (this.el.modal) this.el.modal.classList.remove('active');
    }

    focusRedeem() {
        this.open();
        if (this.loggedIn() && this.el.redeemInput) setTimeout(() => this.el.redeemInput.focus(), 50);
    }

    setMsg(el, text, isError) {
        if (!el) return;
        el.textContent = text || '';
        el.classList.toggle('is-error', !!isError);
    }

    toast(message) {
        if (window.shareModuleRef && window.shareModuleRef.toast) window.shareModuleRef.toast(message);
    }

    // ------------------------------------------
    // 渲染
    // ------------------------------------------

    renderButton() {
        const { btn, btnLabel } = this.el;
        if (!btn) return;
        btn.hidden = !this.available;
        if (!this.loggedIn()) {
            btnLabel.textContent = this.pendingReferral() ? '登录领 3 天会员' : '登录';
            btn.classList.remove('is-member');
            return;
        }
        const member = this.me.tier === 'member';
        btnLabel.textContent = member ? '会员 · 我的' : '我的';
        btn.classList.toggle('is-member', member);
    }

    formatDate(ts) {
        return new Intl.DateTimeFormat('zh-CN', {
            timeZone: 'Asia/Shanghai',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date(ts));
    }

    renderProfile() {
        const me = this.me;
        if (!me || !me.loggedIn) return;
        this.el.emailDisplay.textContent = me.email;

        const member = me.tier === 'member';
        const badge = member
            ? `<span class="tier-badge is-member">会员</span><span>有效期至 ${this.formatDate(me.memberUntil)}</span>`
            : '<span class="tier-badge">免费用户</span><span>用兑换码可开通会员</span>';
        this.el.tier.innerHTML = badge;

        const l = me.limits || {};
        const used = (me.usage && me.usage.readings) || 0;
        const left = Math.max(0, (l.readingsPerDay || 0) - used);
        const lines = [`今日 AI 解卦还剩 <b>${left}</b> / ${l.readingsPerDay || 0} 次，每卦可追问 ${l.followupsPerCast || 0} 次`];
        if (me.credits > 0) lines.push(`次数余额 <b>${me.credits}</b> 次（每日次数用完后自动使用）`);
        this.el.usage.innerHTML = lines.map((t) => `<p>${t}</p>`).join('');

        this.el.referralDesc.textContent =
            `好友用你的链接注册，双方各得 ${me.referralDaysEach} 天会员。已邀请 ${me.referralCount} 人，` +
            `已获得 ${me.referralDays} / ${me.referralDaysCap} 天。`;
        this.el.referralLink.value = this.referralUrl();
    }

    // ------------------------------------------
    // 登录
    // ------------------------------------------

    startCooldown(seconds) {
        const btn = this.el.sendBtn;
        let left = seconds;
        clearInterval(this._cooldownTimer);
        btn.disabled = true;
        btn.textContent = `重新获取（${left}s）`;
        this._cooldownTimer = setInterval(() => {
            left -= 1;
            if (left <= 0) {
                clearInterval(this._cooldownTimer);
                btn.disabled = false;
                btn.textContent = '重新获取';
                return;
            }
            btn.textContent = `重新获取（${left}s）`;
        }, 1000);
    }

    async sendCode() {
        const email = this.el.email.value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
            this.setMsg(this.el.loginMsg, '请输入正确的邮箱地址', true);
            this.el.email.focus();
            return;
        }
        this.el.sendBtn.disabled = true;
        this.setMsg(this.el.loginMsg, '发送中…');
        try {
            const data = await this.call('requestCode', { email });
            this.el.codeGroup.hidden = false;
            this.el.verifyBtn.hidden = false;
            this.setMsg(this.el.loginMsg, `验证码已发送到 ${email}，10 分钟内有效`);
            this.startCooldown(data.cooldown || 60);
            this.el.code.focus();
        } catch (e) {
            this.el.sendBtn.disabled = false;
            this.setMsg(this.el.loginMsg, e.message, true);
        }
    }

    async verify() {
        if (this._verifying) return;
        const email = this.el.email.value.trim();
        const code = this.el.code.value.trim();
        if (!/^\d{6}$/.test(code)) {
            this.setMsg(this.el.loginMsg, '请输入 6 位数字验证码', true);
            this.el.code.focus();
            return;
        }
        this._verifying = true;
        this.el.verifyBtn.disabled = true;
        try {
            const data = await this.call('verifyCode', { email, code, referral: this.pendingReferral() });
            try { localStorage.removeItem(this.REFERRAL_KEY); } catch (e) { /* ignore */ }
            clearInterval(this._cooldownTimer);
            this.el.sendBtn.disabled = false;
            this.el.sendBtn.textContent = '获取验证码';
            this.el.code.value = '';
            this.el.codeGroup.hidden = true;
            this.el.verifyBtn.hidden = true;
            await this.refresh();
            this.close();
            this.toast(data.referred ? '注册成功，已获得 3 天会员' : (data.isNew ? '注册成功，欢迎' : '登录成功'));
        } catch (e) {
            this.setMsg(this.el.loginMsg, e.message, true);
        } finally {
            this._verifying = false;
            this.el.verifyBtn.disabled = false;
        }
    }

    async logout() {
        try { await this.call('logout'); } catch (e) { /* ignore */ }
        this.close();
        await this.refresh();
        this.toast('已退出登录');
    }

    async redeem() {
        const code = this.el.redeemInput.value.trim();
        if (!code) {
            this.el.redeemInput.focus();
            return;
        }
        this.el.redeemBtn.disabled = true;
        try {
            const data = await this.call('redeem', { code });
            this.el.redeemInput.value = '';
            this.setMsg(this.el.redeemMsg, data.message);
            await this.refresh();
        } catch (e) {
            this.setMsg(this.el.redeemMsg, e.message, true);
        } finally {
            this.el.redeemBtn.disabled = false;
        }
    }

    // ------------------------------------------
    // 卦历
    // ------------------------------------------

    saveHistory(item) {
        if (!this.loggedIn() || !item || !item.id) return;
        this.call('historySave', { item }).catch((e) => console.warn('卦历保存失败:', e.message));
    }

    async openHistory() {
        const { historyModal, historyList } = this.el;
        if (!historyModal) return;
        this.close();
        historyModal.classList.add('active');
        historyList.innerHTML = '<p class="history-empty">读取中…</p>';
        try {
            const { items } = await this.call('historyList');
            this.renderHistory(items || []);
        } catch (e) {
            historyList.innerHTML = '';
            const p = document.createElement('p');
            p.className = 'history-empty';
            p.textContent = e.message;
            historyList.appendChild(p);
        }
    }

    renderHistory(items) {
        const list = this.el.historyList;
        list.innerHTML = '';
        if (!items.length) {
            list.innerHTML = '<p class="history-empty">还没有卦历。登录后起的卦会自动保存在这里。</p>';
            return;
        }
        items.forEach((s) => {
            const row = document.createElement('div');
            row.className = 'history-item';

            const open = document.createElement('button');
            open.type = 'button';
            open.className = 'history-open';
            const title = document.createElement('span');
            title.className = 'history-hex';
            title.textContent = s.changed ? `${s.main} → ${s.changed}` : s.main;
            const q = document.createElement('span');
            q.className = 'history-question';
            q.textContent = s.question;
            const meta = document.createElement('span');
            meta.className = 'history-meta';
            meta.textContent = this.formatDate(s.ts) + (s.followups ? ` · 追问 ${s.followups} 次` : '');
            open.append(title, q, meta);
            open.addEventListener('click', () => this.openRecord(s.id));

            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'history-delete';
            del.setAttribute('aria-label', '删除');
            del.textContent = '×';
            del.addEventListener('click', async () => {
                if (!confirm('删除这条卦历？')) return;
                try {
                    await this.call('historyDelete', { id: s.id });
                    row.remove();
                    if (!list.querySelector('.history-item')) this.renderHistory([]);
                } catch (e) {
                    this.toast(e.message);
                }
            });

            row.append(open, del);
            list.appendChild(row);
        });
    }

    async openRecord(id) {
        try {
            const { item } = await this.call('historyGet', { id });
            this.el.historyModal.classList.remove('active');
            if (this.callbacks.onOpenRecord) this.callbacks.onOpenRecord(item);
        } catch (e) {
            this.toast(e.message);
        }
    }

    // ------------------------------------------
    // 事件
    // ------------------------------------------

    bind() {
        const el = this.el;
        if (!el.modal) return;
        el.btn.addEventListener('click', () => this.open());
        document.getElementById('account-modal-close').addEventListener('click', () => this.close());
        el.modal.addEventListener('click', (e) => { if (e.target === el.modal) this.close(); });
        el.sendBtn.addEventListener('click', () => this.sendCode());
        el.verifyBtn.addEventListener('click', () => this.verify());
        el.email.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.sendCode(); });
        el.code.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.verify(); });
        el.code.addEventListener('input', () => {
            if (/^\d{6}$/.test(el.code.value.trim())) this.verify();
        });
        el.redeemBtn.addEventListener('click', () => this.redeem());
        el.redeemInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.redeem(); });
        el.referralCopy.addEventListener('click', () => {
            const url = this.referralUrl();
            if (url && window.shareModuleRef) window.shareModuleRef.copyText(url, '邀请链接已复制，发给好友吧');
        });
        el.historyBtn.addEventListener('click', () => this.openHistory());
        el.logoutBtn.addEventListener('click', () => this.logout());

        const closeHistory = () => el.historyModal.classList.remove('active');
        document.getElementById('history-modal-close').addEventListener('click', closeHistory);
        el.historyModal.addEventListener('click', (e) => { if (e.target === el.historyModal) closeHistory(); });
    }
}

window.AccountModule = AccountModule;
