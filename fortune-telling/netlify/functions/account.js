/**
 * 账号接口
 * POST /api/account  body: { action, deviceId?, ... }
 *   action: requestCode / verifyCode / logout / me / redeem / historySave / historyList / historyGet / historyDelete
 * 会话放在 HttpOnly Cookie 里，只服务同域页面，因此不开 CORS
 */

const { getStore, connectLambda } = require('@netlify/blobs');
const account = require('../lib/account.js');
const quota = require('../lib/quota.js');
const { createMailer } = require('../lib/mailer.js');

const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
};

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    let body;
    try {
        body = JSON.parse(event.body || '{}');
    } catch (e) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: '无效的请求数据' }) };
    }

    connectLambda(event);
    const hdrs = event.headers || {};
    const analyticsAdd = quota.blobsAnalyticsAdd(getStore);
    const day = quota.shanghaiDate();
    const result = await account.handle({
        action: body.action,
        body,
        cookie: hdrs.cookie || hdrs.Cookie || '',
        ip: hdrs['x-nf-client-connection-ip'] || (hdrs['x-forwarded-for'] || '').split(',')[0].trim(),
        deviceId: body.deviceId,
        secure: (hdrs['x-forwarded-proto'] || 'https') === 'https'
    }, account.blobsStores(getStore), {
        sendMail: createMailer({ allowConsole: false }),
        quotaStore: quota.blobsStore(getStore),
        bump: (names) => analyticsAdd(names.flatMap((n) => [[`ev:${n}:total`, 1], [`ev:${n}:${day}`, 1]]))
    });

    const out = { statusCode: result.status, headers: Object.assign({}, headers), body: JSON.stringify(result.body) };
    if (result.cookie) out.headers['Set-Cookie'] = result.cookie;
    return out;
};
