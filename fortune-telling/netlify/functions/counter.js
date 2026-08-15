/**
 * 求卦计数接口
 * GET  /api/counter  -> 读取今日总次数 / 累计（不自增）
 * POST /api/counter  body: { deviceId }
 *   -> 自增，并返回：
 *      rank  今日第几位（按 deviceId 去重，同一设备当天保持同一编号）
 *      times 该设备今日第几次求卦
 *      count 今日求卦总次数
 *      total 累计求卦总次数
 */

const { getStore, connectLambda } = require('@netlify/blobs');
const { recordDivination, dayCount } = require('../lib/divination-counter');

function todayKey() {
    const d = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());
    return `divinations:${d}`;
}

const TOTAL_KEY = 'divinations:total';

exports.handler = async (event) => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'no-store'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers };
    }

    try {
        connectLambda(event);
        const store = getStore('counters');
        const dayKey = todayKey();

        let rawDay = (await store.get(dayKey, { type: 'json' })) || { count: 0 };
        let total = (await store.get(TOTAL_KEY, { type: 'json' })) || { count: 0 };

        let rank = null;
        let times = null;

        if (event.httpMethod === 'POST') {
            let deviceId = null;
            try {
                const body = JSON.parse(event.body || '{}');
                deviceId = body.deviceId || null;
            } catch (e) { /* ignore */ }

            const result = recordDivination(rawDay, deviceId);
            rawDay = result.day;
            rank = result.rank;
            times = result.times;
            total = { count: (total.count || 0) + 1 };
            await store.setJSON(dayKey, rawDay);
            await store.setJSON(TOTAL_KEY, total);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                rank,
                times,
                count: dayCount(rawDay),
                unique: (rawDay && rawDay.unique) || 0,
                today: rank,
                total: total.count || 0
            })
        };
    } catch (e) {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ today: null, rank: null, times: null, total: null, error: e.message })
        };
    }
};
