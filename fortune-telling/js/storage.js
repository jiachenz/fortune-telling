/**
 * 本地存储 + 轻身份模块
 * ================================================
 * - 匿名 deviceId（UUID）：身份底座，零登录 UI，未来可绑定正式账号
 * - 连续观易天数（打卡 streak）：以「完成一次起卦」为当日打卡
 * - 决策日志：所问 + 卦象 + 建议 + 日期，本地私密留存
 * - 里程碑解锁：7 / 21 / 49 天
 *
 * 全部存 localStorage，纯本机、私密。
 */

class StorageModule {
    constructor() {
        this.KEY = 'fortune_growth';
        this.MILESTONES = [7, 21, 49];
        this.JOURNAL_LIMIT = 200;
        this.data = this._load();
        this._ensureDeviceId();
    }

    _load() {
        try {
            const raw = localStorage.getItem(this.KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) { /* ignore */ }
        return {
            deviceId: null,
            streak: 0,
            lastCheckIn: null,
            totalDivinations: 0,
            firstVisitDate: null,
            lastVisitDate: null,
            visitDays: 0,
            milestones: [],
            journal: []
        };
    }

    _save() {
        try {
            localStorage.setItem(this.KEY, JSON.stringify(this.data));
        } catch (e) { /* 存储不可用时静默 */ }
    }

    _today() {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Shanghai',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());
    }

    _yesterday() {
        const now = new Date();
        // 以上海时区回退一天
        const shifted = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Shanghai',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(shifted);
    }

    _ensureDeviceId() {
        if (!this.data.deviceId) {
            this.data.deviceId = this._genId();
            this._save();
        }
    }

    _genId() {
        try {
            if (window.crypto && typeof crypto.randomUUID === 'function') {
                return crypto.randomUUID();
            }
        } catch (e) { /* ignore */ }
        return 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    }

    getDeviceId() {
        return this.data.deviceId;
    }

    /**
     * 记录一次访问（用于留存统计：次日/7日回访）
     */
    recordVisit() {
        const today = this._today();
        if (!this.data.firstVisitDate) this.data.firstVisitDate = today;
        if (this.data.lastVisitDate !== today) {
            this.data.visitDays = (this.data.visitDays || 0) + 1;
            this.data.lastVisitDate = today;
            this._save();
        }
    }

    /**
     * 完成一次起卦 = 当日打卡。更新连续天数并返回是否解锁新里程碑。
     * @returns {{ streak:number, total:number, newMilestone:(number|null) }}
     */
    checkIn() {
        const today = this._today();
        this.data.totalDivinations = (this.data.totalDivinations || 0) + 1;

        if (this.data.lastCheckIn === today) {
            // 今日已打卡，连续天数不变
        } else if (this.data.lastCheckIn === this._yesterday()) {
            this.data.streak = (this.data.streak || 0) + 1;
            this.data.lastCheckIn = today;
        } else {
            this.data.streak = 1;
            this.data.lastCheckIn = today;
        }

        let newMilestone = null;
        for (const m of this.MILESTONES) {
            if (this.data.streak >= m && !this.data.milestones.includes(m)) {
                this.data.milestones.push(m);
                newMilestone = m;
            }
        }

        this._save();
        return { streak: this.data.streak, total: this.data.totalDivinations, newMilestone };
    }

    getStreak() {
        return this.data.streak || 0;
    }

    getTotalDivinations() {
        return this.data.totalDivinations || 0;
    }

    /**
     * 当前已达成的最高里程碑（用于展示/解锁样式），无则返回 null
     */
    getHighestMilestone() {
        const reached = this.MILESTONES.filter((m) => (this.data.milestones || []).includes(m));
        return reached.length ? Math.max(...reached) : null;
    }

    /**
     * 追加一条决策日志
     */
    addJournal(entry) {
        const record = {
            ts: Date.now(),
            date: this._today(),
            question: entry.question || '',
            main: entry.main || '',
            changed: entry.changed || '',
            advice: entry.advice || ''
        };
        this.data.journal = this.data.journal || [];
        this.data.journal.unshift(record);
        if (this.data.journal.length > this.JOURNAL_LIMIT) {
            this.data.journal = this.data.journal.slice(0, this.JOURNAL_LIMIT);
        }
        this._save();
        return record;
    }

    getJournal() {
        return this.data.journal || [];
    }
}

window.StorageModule = StorageModule;
