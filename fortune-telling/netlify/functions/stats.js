/**
 * 聚合指标接口（仅持有 STATS_TOKEN 的人可看）
 * GET /api/stats
 *   Header: Authorization: Bearer <token>
 *   或 query: ?token=<token>
 *
 * 线上：读 Netlify Blobs（counters + analytics）
 * 未配置 STATS_TOKEN 时一律 401，避免数据裸奔
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
    try {
        const qs = event.queryStringParameters || {};
        return (qs.token || '').trim();
    } catch (e) {
        return '';
    }
}

function authorized(event) {
    const expected = process.env.STATS_TOKEN;
    if (!expected) return false;
    const got = extractToken(event);
    return got && got === expected;
}

async function listAll(store) {
    const map = {};
    let cursor;
    do {
        const page = await store.list({ paginate: true, cursor });
        const blobs = page.blobs || [];
        for (const blob of blobs) {
            const value = await store.get(blob.key, { type: 'json' });
            if (value && typeof value === 'object' && typeof value.count === 'number') {
                map[blob.key] = value.count;
            } else if (typeof value === 'number') {
                map[blob.key] = value;
            }
        }
        cursor = page.next_cursor || page.nextCursor;
    } while (cursor);
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
        return {
            statusCode: 200,
            headers: cors,
            body: JSON.stringify(aggregateFromMap(map))
        };
    } catch (e) {
        return {
            statusCode: 500,
            headers: cors,
            body: JSON.stringify({ error: e.message })
        };
    }
};
