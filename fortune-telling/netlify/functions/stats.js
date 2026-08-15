/**
 * 聚合指标接口（仅持有 STATS_TOKEN 的人可看）
 * GET /api/stats
 *   Header: Authorization: Bearer <token>
 *
 * 线上：读 Netlify Blobs（counters + analytics）
 * 未配置 STATS_TOKEN 时一律 401，避免数据裸奔
 * 不接受 query token，避免密钥出现在 URL / 访问日志里
 */

const { getStore, connectLambda } = require('@netlify/blobs');
const { aggregateFromMap } = require('../lib/aggregate-stats');

const cors = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store'
};

function extractToken(event) {
    const header = event.headers || {};
    const auth = header.authorization || header.Authorization || '';
    if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
    return '';
}

function authorized(event) {
    const expected = process.env.STATS_TOKEN;
    if (!expected) return false;
    const got = extractToken(event);
    return got && got === expected;
}

async function listAll(store) {
    const map = {};
    // 默认 list() 会自动翻页并返回 { blobs: [{ key, etag }] }
    // paginate:true 会变成 AsyncIterator，不能当普通对象用
    const { blobs } = await store.list();
    for (const blob of blobs || []) {
        const value = await store.get(blob.key, { type: 'json' });
        if (value && typeof value === 'object' && typeof value.count === 'number') {
            map[blob.key] = value.count;
        } else if (typeof value === 'number') {
            map[blob.key] = value;
        }
    }
    return map;
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: cors };
    }
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }
    if (!authorized(event)) {
        return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    try {
        connectLambda(event);
        const counters = getStore('counters');
        const analytics = getStore('analytics');
        const [counterMap, analyticsMap] = await Promise.all([
            listAll(counters),
            listAll(analytics)
        ]);
        const map = Object.assign({}, counterMap, analyticsMap);
        const payload = aggregateFromMap(map);
        payload.meta = {
            counterKeys: Object.keys(counterMap).length,
            analyticsKeys: Object.keys(analyticsMap).length
        };
        return {
            statusCode: 200,
            headers: cors,
            body: JSON.stringify(payload)
        };
    } catch (e) {
        return {
            statusCode: 500,
            headers: cors,
            body: JSON.stringify({ error: e.message })
        };
    }
};
