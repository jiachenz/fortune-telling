/**
 * 轻量埋点接口
 * POST /api/track  body: { event, cardType?, ref?, deviceId? }
 *
 * 存储：Netlify Blobs（同域、无 Cookie、国内可用）。
 * 采用「计数」而非明细日志，隐私友好、成本极低。
 * 始终返回 204，前端 fire-and-forget，不阻塞交互。
 */

const { getStore } = require('@netlify/blobs');

const ALLOWED_EVENTS = new Set([
    'result_view',
    'share_open',
    'share_click',
    'card_generated',
    'landing'
]);

function today() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());
}

async function bump(store, key) {
    const cur = (await store.get(key, { type: 'json' })) || { count: 0 };
    await store.setJSON(key, { count: (cur.count || 0) + 1 });
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers };
    }
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers };
    }

    try {
        const { event: name, cardType, ref } = JSON.parse(event.body || '{}');
        if (!name || !ALLOWED_EVENTS.has(name)) {
            return { statusCode: 204, headers };
        }

        const store = getStore('analytics');
        const day = today();
        const keys = [`ev:${name}:total`, `ev:${name}:${day}`];
        if (cardType) keys.push(`ev:${name}:card:${cardType}:total`);
        if (ref) keys.push(`ev:${name}:ref:${ref}:total`);

        await Promise.all(keys.map((k) => bump(store, k)));
    } catch (e) {
        // 静默失败，埋点不能影响用户体验
    }

    return { statusCode: 204, headers };
};
