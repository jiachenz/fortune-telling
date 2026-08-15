/**
 * 求卦计数接口
 * GET  /api/counter  -> 读取「今日/累计」求卦数（不自增）
 * POST /api/counter  -> 自增并返回最新「今日/累计」数
 *
 * 存储：Netlify Blobs（免费版可用，无需数据库）。
 * 出错时返回 200 + null，前端优雅降级（不显示编号即可）。
 */

const { getStore, connectLambda } = require('@netlify/blobs');

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
        // Lambda 兼容格式必须先注入上下文，否则会报未配置 siteID/token
        connectLambda(event);
        const store = getStore('counters');
        const dayKey = todayKey();

        let today = (await store.get(dayKey, { type: 'json' })) || { count: 0 };
        let total = (await store.get(TOTAL_KEY, { type: 'json' })) || { count: 0 };

        if (event.httpMethod === 'POST') {
            today = { count: (today.count || 0) + 1 };
            total = { count: (total.count || 0) + 1 };
            await store.setJSON(dayKey, today);
            await store.setJSON(TOTAL_KEY, total);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ today: today.count, total: total.count })
        };
    } catch (e) {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ today: null, total: null, error: e.message })
        };
    }
};
