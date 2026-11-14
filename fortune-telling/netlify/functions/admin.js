/**
 * 管理接口（兑换码 / 手动开通）
 * POST /api/admin  Header: Authorization: Bearer <ADMIN_TOKEN>  body: { action, ... }
 *   action: generate / list / disable / grant / user
 * 未配置 ADMIN_TOKEN 时使用 STATS_TOKEN；两者都没有时一律 401
 */

const { getStore, connectLambda } = require('@netlify/blobs');
const account = require('../lib/account.js');

const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
};

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }
    const hdrs = event.headers || {};
    if (!account.adminAuthorized(hdrs.authorization || hdrs.Authorization, false)) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    let body;
    try {
        body = JSON.parse(event.body || '{}');
    } catch (e) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: '无效的请求数据' }) };
    }

    connectLambda(event);
    const result = await account.handleAdmin({ action: body.action, body }, account.blobsStores(getStore));
    return { statusCode: result.status, headers, body: JSON.stringify(result.body) };
};
