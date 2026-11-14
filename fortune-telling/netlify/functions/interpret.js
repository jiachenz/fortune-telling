/**
 * AI 解卦接口 - 非流式版本
 * POST /api/interpret
 */

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch (e) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: '无效的请求数据' })
        };
    }

    const { hexagramData, userQuestion, yaoResults, history, followUp, deviceId } = body;

    if (!hexagramData || !userQuestion || !yaoResults) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: '缺少必要参数' })
        };
    }

    const API_KEY = process.env.API_KEY;
    const API_BASE = process.env.API_BASE || 'https://openrouter.ai/api/v1';
    const MODEL_NAME = process.env.MODEL_NAME || 'stepfun/step-3.5-flash:free';

    if (!API_KEY) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'API Key 未配置', useLocal: true })
        };
    }

    const {
        buildSystemPrompt,
        buildUserPrompt,
        normalizeHistory,
        normalizeFollowUp
    } = require('../lib/prompt.js');

    const followUpText = normalizeFollowUp(followUp);
    const historyNorm = normalizeHistory(history);

    const quota = require('../lib/quota.js');
    const account = require('../lib/account.js');
    const { callUpstream, safeRecordUsage } = require('../lib/usage.js');
    const { getStore, connectLambda } = require('@netlify/blobs');
    let quotaStore = null;
    let accountStores = null;
    let ident = null;
    let verdict = null;
    try {
        connectLambda(event);
        quotaStore = quota.blobsStore(getStore);
        accountStores = account.blobsStores(getStore);
        const hdrs = event.headers || {};
        const user = await account.safeResolveQuotaUser(accountStores, hdrs.cookie || hdrs.Cookie);
        ident = quota.buildIdentity({
            deviceId,
            ip: hdrs['x-nf-client-connection-ip'] || (hdrs['x-forwarded-for'] || '').split(',')[0].trim(),
            castAt: hexagramData.castAt,
            followUp: followUpText,
            user
        });
    } catch (e) {
        console.error('限额初始化失败，放行:', e.message);
    }
    if (quotaStore && ident) {
        verdict = await quota.safeCheck(quotaStore, ident);
        if (!verdict.allowed) {
            await quota.safeRecordDenied(quotaStore, ident, verdict.kind, quota.blobsAnalyticsBump(getStore));
            return {
                statusCode: 429,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: verdict.message,
                    quotaExceeded: true,
                    kind: verdict.kind,
                    tier: verdict.tier
                })
            };
        }
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const messages = [
            { role: 'system', content: buildSystemPrompt({ followUp: followUpText }) },
            {
                role: 'user',
                content: buildUserPrompt(hexagramData, userQuestion, yaoResults, {
                    followUp: followUpText,
                    history: historyNorm
                })
            }
        ];
        const response = await callUpstream({
            apiBase: API_BASE,
            apiKey: API_KEY,
            signal: controller.signal,
            payload: {
                model: MODEL_NAME,
                messages,
                temperature: 0.7,
                max_tokens: 16000
            }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error('AI 返回内容为空');
        }

        if (quotaStore && ident) {
            await quota.safeConsume(quotaStore, ident, verdict, () => account.spendCredit(accountStores, ident.user.id));
            await safeRecordUsage(quota.blobsAnalyticsAdd(getStore), { usage: data.usage, messages, output: content });
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, content })
        };

    } catch (error) {
        console.error('请求失败:', error);
        const isTimeout = error.name === 'AbortError';
        
        return {
            statusCode: isTimeout ? 504 : 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: isTimeout ? 'AI 响应超时' : error.message,
                useLocal: true
            })
        };
    }
};
