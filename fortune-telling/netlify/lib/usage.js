/**
 * 模型调用与 token 用量记账（Netlify Functions 与本地 server 共用）
 * 用量写入 analytics：ev:ai_calls / ev:tokens_in / ev:tokens_out（:total 与 :YYYY-MM-DD）
 * 上游没返回 usage 时按字数估算（中文约 1 字 1 token，不含思考 token，会偏低），并计入 ev:ai_calls_est
 */

const { shanghaiDate } = require('./quota.js');

function estimateTokens(text) {
    return String(text || '').length;
}

/**
 * 流式请求带上 include_usage 以拿到最后一块的 usage；个别上游不认这个参数会回 400，此时去掉重试一次
 */
async function callUpstream({ apiBase, apiKey, payload, signal }) {
    const send = (body) => fetch(`${apiBase}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        signal,
        body: JSON.stringify(body)
    });
    if (!payload.stream) return send(payload);
    const res = await send(Object.assign({}, payload, { stream_options: { include_usage: true } }));
    if (res.status !== 400) return res;
    await res.text().catch(() => '');
    return send(payload);
}

async function recordUsage(add, { usage, messages, output }) {
    const day = shanghaiDate();
    let tokensIn = usage && usage.prompt_tokens;
    let tokensOut = usage && usage.completion_tokens;
    const estimated = !(tokensIn >= 0 && tokensOut >= 0);
    if (estimated) {
        tokensIn = estimateTokens((messages || []).map((m) => m.content).join('\n'));
        tokensOut = estimateTokens(output);
    }
    const entries = [];
    const both = (name, n) => entries.push([`ev:${name}:total`, n], [`ev:${name}:${day}`, n]);
    both('ai_calls', 1);
    both('tokens_in', tokensIn);
    both('tokens_out', tokensOut);
    if (estimated) both('ai_calls_est', 1);
    await add(entries);
}

async function safeRecordUsage(add, info) {
    try {
        await recordUsage(add, info);
    } catch (e) {
        console.error('用量记账失败:', e.message);
    }
}

module.exports = { callUpstream, safeRecordUsage };
