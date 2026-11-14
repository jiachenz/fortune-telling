/**
 * 登录验证码发信（Resend）
 * 未配置 RESEND_API_KEY 时：本地开发打印到控制台，线上直接报错
 */

function loginCodeEmail(code) {
    const subject = `${code} 是你的周易六爻登录验证码`;
    const text = `你的登录验证码是 ${code}，10 分钟内有效。\n\n如果不是你本人操作，忽略这封邮件即可。`;
    const html = `
<div style="max-width:480px;margin:0 auto;padding:32px 24px;font-family:'PingFang SC','Microsoft YaHei',serif;color:#2c2c2c;background:#fffef5;border:1px solid #ecdcaa;border-radius:12px;">
  <p style="margin:0 0 8px;font-size:20px;color:#c41e3a;letter-spacing:4px;">周易六爻 · 知几而决</p>
  <p style="margin:0 0 24px;font-size:14px;color:#777;">你正在登录，验证码 10 分钟内有效：</p>
  <p style="margin:0 0 24px;font-size:36px;font-weight:700;letter-spacing:10px;color:#c41e3a;">${code}</p>
  <p style="margin:0;font-size:12px;color:#999;">如果不是你本人操作，忽略这封邮件即可。</p>
</div>`;
    return { subject, text, html };
}

function createMailer({ allowConsole }) {
    return async ({ to, code }) => {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            if (!allowConsole) throw new Error('RESEND_API_KEY 未配置');
            console.log(`[本地开发] ${to} 的登录验证码：${code}`);
            return;
        }
        const { subject, text, html } = loginCodeEmail(code);
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                from: process.env.MAIL_FROM || '周易六爻 <onboarding@resend.dev>',
                to: [to],
                subject,
                text,
                html
            })
        });
        if (!res.ok) {
            throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
        }
    };
}

module.exports = { createMailer };
