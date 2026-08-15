/**
 * 把 counter / analytics 的扁平 key → 聚合指标
 * 输入 map: { "divinations:2026-08-15": 3, "ev:share_click:total": 2, ... }
 */

const EVENTS = ['result_view', 'share_open', 'share_click', 'card_generated', 'landing'];

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

    const series = dates.map((date) => ({
        date,
        divinations: divByDay[date] || 0,
        result_view: (eventByDay.result_view || {})[date] || 0,
        share_click: (eventByDay.share_click || {})[date] || 0,
        landing: (eventByDay.landing || {})[date] || 0
    }));

    return {
        generatedAt: new Date().toISOString(),
        today,
        divinations: {
            today: divinationsToday,
            total: divinationsTotal
        },
        events: eventTotals,
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
