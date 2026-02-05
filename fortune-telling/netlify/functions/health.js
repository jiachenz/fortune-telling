/**
 * 健康检查接口
 * GET /api/health
 */

exports.handler = async (event, context) => {
    // 只允许 GET 请求
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
            status: 'ok',
            message: '周易六爻占卜服务运行中',
            hasApiKey: !!process.env.API_KEY
        })
    };
};
