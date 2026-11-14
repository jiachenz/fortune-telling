/**
 * 把 counter / analytics 的扁平 key → 聚合指标
 * 输入 map: { "divinations:2026-08-15": 3, "ev:share_click:total": 2, ... }
 */

const EVENTS = [
    'result_view', 'share_open', 'share_click', 'card_generated', 'landing',
    // 免费次数触顶人数（每设备每天每类只记一次，服务端写入）
    'quota_hit_reading', 'quota_hit_followup',
    // 账号
    'signup', 'referral_signup', 'redeem',
    // 模型用量（服务端写入，tokens_* 为 token 数之和）
    'ai_calls', 'ai_calls_est', 'tokens_in', 'tokens_out'
];

function floatFromEnv(name, fallback) {
    const n = parseFloat(process.env[name]);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function pricing() {
    return {
        inputPerM: floatFromEnv('PRICE_INPUT_PER_M', 0.25),
        outputPerM: floatFromEnv('PRICE_OUTPUT_PER_M', 1.5),
        usdCny: floatFromEnv('USD_CNY', 7.2)
    };
}

function costCny(tokensIn, tokensOut, p) {
    const usd = (tokensIn * p.inputPerM + tokensOut * p.outputPerM) / 1e6;
    return Math.round(usd * p.usdCny * 100) / 100;
}

function rate(num, den) {
    if (!den) return null;
    return Math.round((num / den) * 1000) / 1000;
}

function shanghaiToday() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());
}

function lastNDates(n) {
    const today = shanghaiToday();
    const [y, m, d] = today.split('-').map(Number);
    const out = [];
    const utc = Date.UTC(y, m - 1, d);
    for (let i = n - 1; i >= 0; i--) {
        const dt = new Date(utc - i * 86400000);
        out.push(dt.toISOString().slice(0, 10));
    }
    return out;
}

function aggregateFromMap(map) {
    const today = shanghaiToday();
    const dates = lastNDates(30);

    const divByDay = {};
    const eventTotals = {};
    const eventByDay = {};
    const cards = {};
    const refs = {};

    EVENTS.forEach((name) => {
        eventTotals[name] = 0;
        eventByDay[name] = {};
    });

    Object.entries(map).forEach(([key, count]) => {
        const n = Number(count) || 0;
        if (key === 'divinations:total') return;
        if (key.startsWith('divinations:')) {
            divByDay[key.slice('divinations:'.length)] = n;
            return;
        }
        const cardMatch = key.match(/^ev:([^:]+):card:([^:]+):total$/);
        if (cardMatch) {
            cards[cardMatch[2]] = (cards[cardMatch[2]] || 0) + n;
            return;
        }
        const refMatch = key.match(/^ev:([^:]+):ref:([^:]+):total$/);
        if (refMatch) {
            refs[refMatch[2]] = (refs[refMatch[2]] || 0) + n;
            return;
        }
        const dayMatch = key.match(/^ev:([^:]+):(\d{4}-\d{2}-\d{2})$/);
        if (dayMatch) {
            const [, name, date] = dayMatch;
            if (!eventByDay[name]) eventByDay[name] = {};
            eventByDay[name][date] = n;
            return;
        }
        const totalMatch = key.match(/^ev:([^:]+):total$/);
        if (totalMatch) {
            eventTotals[totalMatch[1]] = n;
        }
    });

    const divinationsToday = divByDay[today] || 0;
    const divinationsTotal = Object.values(divByDay).reduce((s, v) => s + v, 0);

    const views = eventTotals.result_view || 0;
    const clicks = eventTotals.share_click || 0;
    const landings = eventTotals.landing || 0;
    const shareRate = rate(clicks, views);
    const conversionRate = rate(landings, clicks);
    const kFactor = (shareRate != null && conversionRate != null)
        ? Math.round(shareRate * conversionRate * 1000) / 1000
        : null;

    const p = pricing();
    const onDay = (name, date) => (eventByDay[name] || {})[date] || 0;

    const series = dates.map((date) => ({
        date,
        divinations: divByDay[date] || 0,
        result_view: onDay('result_view', date),
        share_click: onDay('share_click', date),
        landing: onDay('landing', date),
        quota_hit_reading: onDay('quota_hit_reading', date),
        quota_hit_followup: onDay('quota_hit_followup', date),
        signup: onDay('signup', date),
        redeem: onDay('redeem', date),
        ai_calls: onDay('ai_calls', date),
        cost_cny: costCny(onDay('tokens_in', date), onDay('tokens_out', date), p)
    }));

    const quotaHits = {
        readingToday: onDay('quota_hit_reading', today),
        followupToday: onDay('quota_hit_followup', today)
    };

    const accounts = {
        signupToday: onDay('signup', today),
        signupTotal: eventTotals.signup || 0,
        referralTotal: eventTotals.referral_signup || 0,
        redeemToday: onDay('redeem', today),
        redeemTotal: eventTotals.redeem || 0
    };

    const usageToday = {
        calls: onDay('ai_calls', today),
        estimatedCalls: onDay('ai_calls_est', today),
        tokensIn: onDay('tokens_in', today),
        tokensOut: onDay('tokens_out', today)
    };
    const usageTotal = {
        calls: eventTotals.ai_calls || 0,
        estimatedCalls: eventTotals.ai_calls_est || 0,
        tokensIn: eventTotals.tokens_in || 0,
        tokensOut: eventTotals.tokens_out || 0
    };
    const usage = {
        pricing: p,
        today: Object.assign(usageToday, { costCny: costCny(usageToday.tokensIn, usageToday.tokensOut, p) }),
        total: Object.assign(usageTotal, { costCny: costCny(usageTotal.tokensIn, usageTotal.tokensOut, p) })
    };

    return {
        generatedAt: new Date().toISOString(),
        today,
        divinations: {
            today: divinationsToday,
            total: divinationsTotal
        },
        events: eventTotals,
        quotaHits,
        accounts,
        usage,
        cards,
        refs,
        kpis: {
            shareRate,
            conversionRate,
            kFactor,
            shareRateLabel: shareRate == null ? '—' : `${Math.round(shareRate * 100)}%`,
            conversionRateLabel: conversionRate == null ? '—' : `${Math.round(conversionRate * 100)}%`,
            kFactorLabel: kFactor == null ? '—' : String(kFactor)
        },
        series
    };
}

module.exports = { aggregateFromMap, EVENTS };
