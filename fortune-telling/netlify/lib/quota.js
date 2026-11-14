/**
 * AI 解卦限额（Netlify Functions 与本地 server 共用）
 * ==========================================
 * 三档：anon（匿名，按设备 + IP 计数）/ user（登录）/ member（会员），登录后按账号计数
 * - 首解：每天 readingsPerDay 次；用完后有次数码余额的登录用户继续按次扣减
 * - 追问：同一卦 followupsPerCast 次；每天总量 = (readingsPerDay + 当日次数码首解) × followupsPerCast
 * - 匿名时同一 IP 的上限是单设备的 IP_FACTOR 倍，防止清缓存换 deviceId 绕过，同时给共享网络留余量
 *
 * store 适配器：{ get: async (key) => object|null, set: async (key, object) => void }
 */

const crypto = require('crypto');

const IP_FACTOR = 3;

const TIERS = {
    anon: { env: 'QUOTA', readings: 2, followups: 1 },
    user: { env: 'QUOTA_USER', readings: 3, followups: 3 },
    member: { env: 'QUOTA_MEMBER', readings: 20, followups: 10 }
};

function intFromEnv(name, fallback) {
    const n = parseInt(process.env[name], 10);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function getLimits(tier) {
    const name = TIERS[tier] ? tier : 'anon';
    const t = TIERS[name];
    return {
        enabled: process.env.QUOTA_DISABLED !== '1',
        tier: name,
        readingsPerDay: intFromEnv(`${t.env}_READINGS_PER_DAY`, t.readings),
        followupsPerCast: intFromEnv(`${t.env}_FOLLOWUPS_PER_CAST`, t.followups)
    };
}

function shanghaiDate(date) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date || new Date());
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
 * @param {{ deviceId?: string, ip?: string, castAt?: string, followUp?: string,
 *           user?: { id: string, tier: string, credits: number } | null }} input
 */
function buildIdentity(input) {
    const user = input.user && input.user.id ? input.user : null;
    return {
        day: shanghaiDate(),
        user,
        tier: user ? user.tier : 'anon',
        device: cleanId(input.deviceId, 64),
        ip: hashIp(input.ip),
        cast: cleanId(input.castAt, 40) || 'unknown',
        kind: input.followUp && String(input.followUp).trim() ? 'followup' : 'reading'
    };
}

function keysFor(ident) {
    if (ident.user) {
        return { owner: `q:${ident.day}:u:${ident.user.id}`, ip: null };
    }
    return {
        owner: ident.device ? `q:${ident.day}:d:${ident.device}` : null,
        ip: ident.ip ? `q:${ident.day}:ip:${ident.ip}` : null
    };
}

function emptyUsage() {
    return { readings: 0, followups: 0, creditReadings: 0, casts: {}, hits: {} };
}

async function loadUsage(store, key) {
    if (!key) return null;
    const raw = await store.get(key);
    return Object.assign(emptyUsage(), raw || {});
}

const MESSAGES = {
    reading: (l) => {
        const head = `今日 AI 解卦（每天 ${l.readingsPerDay} 次）已用完，下面先给出基础解读。次数在明天 0 点恢复`;
        if (l.tier === 'anon') return `${head}，登录后每天可用 ${getLimits('user').readingsPerDay} 次。`;
        if (l.tier === 'user') return `${head}，开通会员每天可用 ${getLimits('member').readingsPerDay} 次。`;
        return `${head}。`;
    },
    followupCast: (l) => {
        const head = `这一卦的 ${l.followupsPerCast} 次追问已用完`;
        if (l.tier === 'anon') return `${head}，登录后每卦可追问 ${getLimits('user').followupsPerCast} 次。`;
        if (l.tier === 'user') return `${head}，开通会员每卦可追问 ${getLimits('member').followupsPerCast} 次。`;
        return `${head}，可以再起一卦继续问。`;
    },
    followupDay: () => '今日追问次数已用完，次数在明天 0 点恢复。'
};

function denied(kind, reason, limits) {
    return { allowed: false, kind, reason, tier: limits.tier, message: MESSAGES[reason](limits) };
}

/**
 * 只检查不扣减；上游模型调用成功后再调用 consume
 */
async function check(store, ident, limits) {
    limits = limits || getLimits(ident.tier);
    if (!limits.enabled) return { allowed: true, kind: ident.kind };

    const keys = keysFor(ident);
    const [own, ip] = await Promise.all([loadUsage(store, keys.owner), loadUsage(store, keys.ip)]);

    if (ident.kind === 'reading') {
        const cap = limits.readingsPerDay;
        const overOwn = own && own.readings - own.creditReadings >= cap;
        const overIp = ip && ip.readings >= cap * IP_FACTOR;
        if (overOwn && ident.user && ident.user.credits > 0) {
            return { allowed: true, kind: 'reading', useCredit: true };
        }
        if (overOwn || overIp) return denied('reading', 'reading', limits);
        return { allowed: true, kind: 'reading' };
    }

    const perCast = limits.followupsPerCast;
    const perDay = (limits.readingsPerDay + ((own && own.creditReadings) || 0)) * perCast;
    if (own && (own.casts[ident.cast] || 0) >= perCast) {
        return denied('followup', 'followupCast', limits);
    }
    if ((own && own.followups >= perDay) || (ip && ip.followups >= perDay * IP_FACTOR)) {
        return denied('followup', 'followupDay', limits);
    }
    return { allowed: true, kind: 'followup' };
}

/**
 * @param {object} verdict check 的返回值
 * @param {() => Promise<void>} [spendCredit] verdict.useCredit 时扣减账号次数余额
 */
async function consume(store, ident, verdict, spendCredit) {
    const keys = keysFor(ident);
    const field = ident.kind === 'reading' ? 'readings' : 'followups';
    const useCredit = !!(verdict && verdict.useCredit);
    await Promise.all([keys.owner, keys.ip].filter(Boolean).map(async (key) => {
        const usage = await loadUsage(store, key);
        usage[field] += 1;
        if (key === keys.owner) {
            if (useCredit) usage.creditReadings += 1;
            if (ident.kind === 'followup') {
                usage.casts[ident.cast] = (usage.casts[ident.cast] || 0) + 1;
            }
        }
        await store.set(key, usage);
    }));
    if (useCredit && spendCredit) await spendCredit();
}

/**
 * 今日已用量，用于「我的」面板展示
 */
async function usageToday(store, ident) {
    const usage = await loadUsage(store, keysFor(ident).owner);
    return usage
        ? { readings: usage.readings - usage.creditReadings, creditReadings: usage.creditReadings, followups: usage.followups }
        : { readings: 0, creditReadings: 0, followups: 0 };
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

async function safeConsume(store, ident, verdict, spendCredit) {
    try {
        await consume(store, ident, verdict, spendCredit);
    } catch (e) {
        console.error('限额记账失败:', e.message);
    }
}

/**
 * 记录一次被拦截：同一设备（或账号）同一天、同一类型只记第一次，看板上得到的是「触顶人数」
 * bumpAnalytics(keys)：给埋点计数 +1 的适配器
 */
async function recordDenied(store, ident, kind, bumpAnalytics) {
    const key = keysFor(ident).owner;
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

/**
 * 埋点计数适配器：entries 为 [[key, n], ...]，n 缺省为 1
 */
function blobsAnalyticsAdd(getStore) {
    const store = getStore('analytics');
    return (entries) => Promise.all(entries.map(async ([key, n]) => {
        const cur = (await store.get(key, { type: 'json' })) || { count: 0 };
        await store.setJSON(key, { count: (cur.count || 0) + (n == null ? 1 : n) });
    }));
}

function blobsAnalyticsBump(getStore) {
    const add = blobsAnalyticsAdd(getStore);
    return (keys) => add(keys.map((k) => [k, 1]));
}

module.exports = {
    getLimits,
    shanghaiDate,
    cleanId,
    hashIp,
    buildIdentity,
    check,
    consume,
    usageToday,
    safeCheck,
    safeConsume,
    safeRecordDenied,
    blobsStore,
    blobsAnalyticsAdd,
    blobsAnalyticsBump
};
