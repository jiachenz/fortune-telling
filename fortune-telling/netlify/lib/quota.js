/**
 * AI 解卦限额（Netlify Functions 与本地 server 共用）
 * ==========================================
 * - 首解：每设备每天 readingsPerDay 次
 * - 追问：同一卦 followupsPerCast 次；每天总量 = readingsPerDay × followupsPerCast
 * - 同一 IP 的上限是单设备的 IP_FACTOR 倍，防止清缓存换 deviceId 绕过，同时给共享网络留余量
 *
 * store 适配器：{ get: async (key) => object|null, set: async (key, object) => void }
 */

const crypto = require('crypto');

const IP_FACTOR = 3;

function intFromEnv(name, fallback) {
    const n = parseInt(process.env[name], 10);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function getLimits() {
    return {
        enabled: process.env.QUOTA_DISABLED !== '1',
        readingsPerDay: intFromEnv('QUOTA_READINGS_PER_DAY', 2),
        followupsPerCast: intFromEnv('QUOTA_FOLLOWUPS_PER_CAST', 1)
    };
}

function shanghaiDate() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());
}

function cleanId(value, maxLen) {
    const s = String(value == null ? '' : value).trim();
    if (!s) return '';
    return s.replace(/[^A-Za-z0-9:._-]/g, '').slice(0, maxLen);
}

function hashIp(ip) {
    if (!ip) return '';
    return crypto.createHash('sha256').update(`fortune-quota:${ip}`).digest('hex').slice(0, 24);
}

/**
 * @param {{ deviceId?: string, ip?: string, castAt?: string, followUp?: string }} input
 */
function buildIdentity(input) {
    return {
        day: shanghaiDate(),
        device: cleanId(input.deviceId, 64),
        ip: hashIp(input.ip),
        cast: cleanId(input.castAt, 40) || 'unknown',
        kind: input.followUp && String(input.followUp).trim() ? 'followup' : 'reading'
    };
}

function keysFor(ident) {
    return {
        device: ident.device ? `q:${ident.day}:d:${ident.device}` : null,
        ip: ident.ip ? `q:${ident.day}:ip:${ident.ip}` : null
    };
}

function emptyUsage() {
    return { readings: 0, followups: 0, casts: {}, hits: {} };
}

async function loadUsage(store, key) {
    if (!key) return null;
    const raw = await store.get(key);
    return Object.assign(emptyUsage(), raw || {});
}

const MESSAGES = {
    reading: (l) => `今日免费 AI 解卦（每天 ${l.readingsPerDay} 次）已用完，下面先给出基础解读。次数在明天 0 点恢复。`,
    followupCast: (l) => `这一卦的 ${l.followupsPerCast} 次免费追问已用完，可以再起一卦继续问。`,
    followupDay: () => '今日免费追问次数已用完，次数在明天 0 点恢复。'
};

function denied(kind, reason, limits) {
    return { allowed: false, kind, reason, message: MESSAGES[reason](limits) };
}

/**
 * 只检查不扣减；上游模型调用成功后再调用 consume
 */
async function check(store, ident, limits) {
    limits = limits || getLimits();
    if (!limits.enabled) return { allowed: true, kind: ident.kind };

    const keys = keysFor(ident);
    const [dev, ip] = await Promise.all([loadUsage(store, keys.device), loadUsage(store, keys.ip)]);

    if (ident.kind === 'reading') {
        const cap = limits.readingsPerDay;
        if ((dev && dev.readings >= cap) || (ip && ip.readings >= cap * IP_FACTOR)) {
            return denied('reading', 'reading', limits);
        }
        return { allowed: true, kind: 'reading' };
    }

    const perCast = limits.followupsPerCast;
    const perDay = limits.readingsPerDay * perCast;
    if (dev && (dev.casts[ident.cast] || 0) >= perCast) {
        return denied('followup', 'followupCast', limits);
    }
    if ((dev && dev.followups >= perDay) || (ip && ip.followups >= perDay * IP_FACTOR)) {
        return denied('followup', 'followupDay', limits);
    }
    return { allowed: true, kind: 'followup' };
}

async function consume(store, ident) {
    const keys = keysFor(ident);
    const field = ident.kind === 'reading' ? 'readings' : 'followups';
    await Promise.all([keys.device, keys.ip].filter(Boolean).map(async (key) => {
        const usage = await loadUsage(store, key);
        usage[field] += 1;
        if (ident.kind === 'followup' && key === keys.device) {
            usage.casts[ident.cast] = (usage.casts[ident.cast] || 0) + 1;
        }
        await store.set(key, usage);
    }));
}

/**
 * 限额存储故障时放行，不影响解卦主流程
 */
async function safeCheck(store, ident, limits) {
    try {
        return await check(store, ident, limits);
    } catch (e) {
        console.error('限额检查失败，放行:', e.message);
        return { allowed: true, kind: ident.kind };
    }
}

async function safeConsume(store, ident) {
    try {
        await consume(store, ident);
    } catch (e) {
        console.error('限额记账失败:', e.message);
    }
}

/**
 * 记录一次被拦截：同一设备同一天、同一类型只记第一次，看板上得到的是「触顶人数」
 * bumpAnalytics(keys)：给埋点计数 +1 的适配器
 */
async function recordDenied(store, ident, kind, bumpAnalytics) {
    const key = keysFor(ident).device;
    if (!key) return;
    const usage = await loadUsage(store, key);
    if (usage.hits[kind]) return;
    usage.hits[kind] = true;
    await store.set(key, usage);
    const name = `quota_hit_${kind}`;
    await bumpAnalytics([`ev:${name}:total`, `ev:${name}:${ident.day}`]);
}

async function safeRecordDenied(store, ident, kind, bumpAnalytics) {
    try {
        await recordDenied(store, ident, kind, bumpAnalytics);
    } catch (e) {
        console.error('触顶埋点失败:', e.message);
    }
}

function blobsStore(getStore) {
    const store = getStore('quota');
    return {
        get: (key) => store.get(key, { type: 'json' }),
        set: (key, value) => store.setJSON(key, value)
    };
}

function blobsAnalyticsBump(getStore) {
    const store = getStore('analytics');
    return (keys) => Promise.all(keys.map(async (key) => {
        const cur = (await store.get(key, { type: 'json' })) || { count: 0 };
        await store.setJSON(key, { count: (cur.count || 0) + 1 });
    }));
}

module.exports = {
    getLimits,
    buildIdentity,
    check,
    consume,
    safeCheck,
    safeConsume,
    safeRecordDenied,
    blobsStore,
    blobsAnalyticsBump
};
