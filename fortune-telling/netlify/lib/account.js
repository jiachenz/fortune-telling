/**
 * 账号 / 权益 / 兑换码 / 邀请 / 卦历（Netlify Functions 与本地 server 共用）
 * ==========================================
 * 权益与支付解耦：会员只是 user.memberUntil，次数码只是 user.credits，
 * 以后接任何收款方式，只需在到账回调里调用 grant。
 *
 * stores：{ accounts, history }，每个都是
 *   { get(key), set(key, value), del(key), create(key, value) => boolean, list(prefix) => string[] }
 *
 * accounts 内的 key：
 *   u:<userId>          用户
 *   e:<emailHash>       邮箱 → userId
 *   r:<referralCode>    邀请码 → userId
 *   dv:<deviceHash>     设备首次注册的账号（邀请奖励防刷）
 *   s:<tokenHash>       会话
 *   o:<emailHash>       验证码
 *   c:<codeHash>        兑换码
 *   cl:<codeHash>       单次兑换码的占用标记
 *   rl:<...>            频率限制计数
 * history 内的 key：
 *   hi:<userId>         卦历索引
 *   h:<userId>:<id>     单条卦历
 */

const crypto = require('crypto');
const quota = require('./quota.js');

const DAY_MS = 86400000;
const SESSION_COOKIE = 'ft_sess';
const SESSION_MS = 30 * DAY_MS;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_COOLDOWN_MS = 60 * 1000;
const OTP_PER_EMAIL_DAY = 10;
const OTP_PER_IP_DAY = 30;
const OTP_MAX_ATTEMPTS = 5;
const REDEEM_FAILS_PER_HOUR = 5;
const REFERRAL_DAYS = 3;
const REFERRAL_CAP_DAYS = 30;
const HISTORY_LIMIT = 200;
const HISTORY_MAX_BYTES = 200 * 1024;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function sha(text) {
    return crypto.createHash('sha256').update(String(text)).digest('hex');
}

function hmac(text) {
    return crypto.createHmac('sha256', process.env.AUTH_SECRET || 'fortune-auth').update(String(text)).digest('hex');
}

function randomFrom(alphabet, len) {
    let out = '';
    for (let i = 0; i < len; i++) out += alphabet[crypto.randomInt(alphabet.length)];
    return out;
}

function safeEqual(a, b) {
    const x = Buffer.from(String(a));
    const y = Buffer.from(String(b));
    return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function ok(body) {
    return { status: 200, body: Object.assign({ ok: true }, body || {}) };
}

function fail(status, error, extra) {
    return { status, body: Object.assign({ ok: false, error }, extra || {}) };
}

// ------------------------------------------
// 邮箱 / 兑换码规范化
// ------------------------------------------

/**
 * address 用于发信与展示；canonical 用于判重（去掉 +tag，Gmail 去掉点）
 */
function normalizeEmail(raw) {
    const address = String(raw || '').trim().toLowerCase();
    if (address.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(address)) return null;
    let [local, domain] = address.split('@');
    local = local.split('+')[0];
    if (domain === 'googlemail.com') domain = 'gmail.com';
    if (domain === 'gmail.com') local = local.replace(/\./g, '');
    if (!local) return null;
    return { address, canonical: `${local}@${domain}` };
}

function normalizeCode(raw) {
    const s = String(raw || '').toUpperCase().replace(/[\s-]/g, '');
    return /^[A-Z0-9]{4,32}$/.test(s) ? s : '';
}

function codeHash(normalized) {
    return sha(`redeem:${normalized}`).slice(0, 40);
}

function formatCode(normalized) {
    return `GUA-${normalized.slice(3, 7)}-${normalized.slice(7)}`;
}

function maskCode(normalized) {
    return `GUA-****-${normalized.slice(-4)}`;
}

function generateCode() {
    return `GUA${randomFrom(CODE_ALPHABET, 8)}`;
}

// ------------------------------------------
// Cookie / 会话
// ------------------------------------------

function parseCookies(header) {
    const out = {};
    String(header || '').split(';').forEach((part) => {
        const i = part.indexOf('=');
        if (i < 0) return;
        const k = part.slice(0, i).trim();
        if (k) out[k] = decodeURIComponent(part.slice(i + 1).trim());
    });
    return out;
}

function sessionCookie(token, secure) {
    return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MS / 1000}${secure ? '; Secure' : ''}`;
}

function clearSessionCookie(secure) {
    return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
}

function sessionToken(cookieHeader) {
    const token = parseCookies(cookieHeader)[SESSION_COOKIE];
    return token && token.length <= 64 ? token : '';
}

async function loadUser(stores, id) {
    return id ? stores.accounts.get(`u:${id}`) : null;
}

async function saveUser(stores, user) {
    await stores.accounts.set(`u:${user.id}`, user);
}

async function resolveUser(stores, cookieHeader) {
    const token = sessionToken(cookieHeader);
    if (!token) return null;
    const sess = await stores.accounts.get(`s:${sha(token)}`);
    if (!sess || sess.exp < Date.now()) return null;
    return loadUser(stores, sess.u);
}

function isMember(user, now) {
    return !!(user && user.memberUntil && user.memberUntil > (now || Date.now()));
}

function tierOf(user) {
    if (!user) return 'anon';
    return isMember(user) ? 'member' : 'user';
}

/**
 * 解卦接口用：拿到 { id, tier, credits }，任何异常都按匿名处理
 */
async function safeResolveQuotaUser(stores, cookieHeader) {
    try {
        const user = await resolveUser(stores, cookieHeader);
        return user ? { id: user.id, tier: tierOf(user), credits: user.credits || 0 } : null;
    } catch (e) {
        console.error('会话解析失败，按匿名处理:', e.message);
        return null;
    }
}

async function spendCredit(stores, userId) {
    const user = await loadUser(stores, userId);
    if (!user || !(user.credits > 0)) return;
    user.credits -= 1;
    await saveUser(stores, user);
}

function addMemberDays(user, days, now) {
    const base = Math.max(now || Date.now(), user.memberUntil || 0);
    user.memberUntil = base + days * DAY_MS;
}

function publicProfile(user, limits, usage) {
    return {
        loggedIn: true,
        email: user.email,
        tier: tierOf(user),
        memberUntil: isMember(user) ? user.memberUntil : null,
        credits: user.credits || 0,
        referralCode: user.referralCode,
        referralCount: user.referralCount || 0,
        referralDays: user.referralDays || 0,
        referralDaysCap: REFERRAL_CAP_DAYS,
        referralDaysEach: REFERRAL_DAYS,
        limits,
        usage
    };
}

// ------------------------------------------
// 频率限制
// ------------------------------------------

async function hitLimit(stores, key, max) {
    const rec = await stores.accounts.get(key);
    return !!(rec && rec.n >= max);
}

async function bumpLimit(stores, key) {
    const rec = (await stores.accounts.get(key)) || { n: 0 };
    rec.n += 1;
    await stores.accounts.set(key, rec);
}

// ------------------------------------------
// 动作
// ------------------------------------------

async function requestCode(req, stores, deps) {
    const email = normalizeEmail(req.body.email);
    if (!email) return fail(400, '请输入正确的邮箱地址');

    const now = Date.now();
    const day = quota.shanghaiDate();
    const otpKey = `o:${hmac(email.canonical).slice(0, 32)}`;
    const rec = await stores.accounts.get(otpKey);

    if (rec && now - rec.sentAt < OTP_COOLDOWN_MS) {
        const wait = Math.ceil((OTP_COOLDOWN_MS - (now - rec.sentAt)) / 1000);
        return fail(429, `发送太频繁，请 ${wait} 秒后再试`, { retryAfter: wait });
    }
    const sentToday = rec && rec.day === day ? rec.sentToday : 0;
    if (sentToday >= OTP_PER_EMAIL_DAY) return fail(429, '这个邮箱今天收取验证码的次数太多，请明天再试');

    const ipKey = req.ip ? `rl:otp:${day}:${quota.hashIp(req.ip)}` : null;
    if (ipKey && await hitLimit(stores, ipKey, OTP_PER_IP_DAY)) {
        return fail(429, '当前网络今天发送的验证码太多，请明天再试');
    }

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    try {
        await deps.sendMail({ to: email.address, code });
    } catch (e) {
        console.error('验证码发送失败:', e.message);
        return fail(502, '验证码发送失败，请稍后再试');
    }

    await stores.accounts.set(otpKey, {
        codeHash: hmac(`${email.canonical}:${code}`),
        exp: now + OTP_TTL_MS,
        attempts: 0,
        sentAt: now,
        day,
        sentToday: sentToday + 1
    });
    if (ipKey) await bumpLimit(stores, ipKey);
    return ok({ cooldown: OTP_COOLDOWN_MS / 1000 });
}

async function applyReferral(stores, user, rawCode, deviceId, now) {
    const code = normalizeCode(rawCode);
    if (!code) return false;
    const ref = await stores.accounts.get(`r:${code}`);
    const inviter = ref && await loadUser(stores, ref.id);
    if (!inviter || inviter.id === user.id) return false;
    if (deviceId && await stores.accounts.get(`dv:${sha(deviceId).slice(0, 32)}`)) return false;

    addMemberDays(user, REFERRAL_DAYS, now);
    user.referredBy = inviter.id;

    inviter.referralCount = (inviter.referralCount || 0) + 1;
    if ((inviter.referralDays || 0) + REFERRAL_DAYS <= REFERRAL_CAP_DAYS) {
        addMemberDays(inviter, REFERRAL_DAYS, now);
        inviter.referralDays = (inviter.referralDays || 0) + REFERRAL_DAYS;
    }
    await saveUser(stores, inviter);
    return true;
}

async function createUser(stores, email, now) {
    let referralCode = '';
    for (let i = 0; i < 5 && !referralCode; i++) {
        const candidate = randomFrom(CODE_ALPHABET, 6);
        if (!(await stores.accounts.get(`r:${candidate}`))) referralCode = candidate;
    }
    const user = {
        id: crypto.randomBytes(9).toString('base64url'),
        email: email.address,
        createdAt: now,
        memberUntil: null,
        credits: 0,
        referralCode,
        referralCount: 0,
        referralDays: 0,
        redeemed: []
    };
    await stores.accounts.set(`e:${hmac(email.canonical).slice(0, 32)}`, { id: user.id });
    if (referralCode) await stores.accounts.set(`r:${referralCode}`, { id: user.id });
    return user;
}

async function verifyCode(req, stores, deps) {
    const email = normalizeEmail(req.body.email);
    if (!email) return fail(400, '请输入正确的邮箱地址');
    const code = String(req.body.code || '').trim();
    if (!/^\d{6}$/.test(code)) return fail(400, '请输入 6 位数字验证码');

    const now = Date.now();
    const emailKey = hmac(email.canonical).slice(0, 32);
    const otpKey = `o:${emailKey}`;
    const rec = await stores.accounts.get(otpKey);
    if (!rec || rec.exp < now) return fail(400, '验证码已过期，请重新获取');
    if (rec.attempts >= OTP_MAX_ATTEMPTS) return fail(400, '尝试次数过多，请重新获取验证码');

    if (!safeEqual(hmac(`${email.canonical}:${code}`), rec.codeHash)) {
        rec.attempts += 1;
        await stores.accounts.set(otpKey, rec);
        const left = OTP_MAX_ATTEMPTS - rec.attempts;
        return fail(400, left > 0 ? `验证码不正确，还可再试 ${left} 次` : '尝试次数过多，请重新获取验证码');
    }
    await stores.accounts.del(otpKey);

    const ref = await stores.accounts.get(`e:${emailKey}`);
    let user = ref && await loadUser(stores, ref.id);
    const isNew = !user;
    let referred = false;
    if (isNew) {
        user = await createUser(stores, email, now);
        referred = await applyReferral(stores, user, req.body.referral, req.deviceId, now);
        if (req.deviceId) await stores.accounts.create(`dv:${sha(req.deviceId).slice(0, 32)}`, { id: user.id });
        if (deps.bump) await deps.bump(['signup', referred ? 'referral_signup' : null].filter(Boolean));
    }
    user.lastLoginAt = now;
    await saveUser(stores, user);

    const token = crypto.randomBytes(32).toString('base64url');
    await stores.accounts.set(`s:${sha(token)}`, { u: user.id, exp: now + SESSION_MS });
    return Object.assign(ok({ isNew, referred }), { cookie: sessionCookie(token, req.secure) });
}

async function logout(req, stores) {
    const token = sessionToken(req.cookie);
    if (token) await stores.accounts.del(`s:${sha(token)}`);
    return Object.assign(ok(), { cookie: clearSessionCookie(req.secure) });
}

async function me(req, stores, deps, user) {
    const tier = tierOf(user);
    const limits = quota.getLimits(tier);
    let usage = null;
    if (deps.quotaStore) {
        try {
            const ident = quota.buildIdentity({
                deviceId: req.deviceId,
                user: user ? { id: user.id, tier } : null
            });
            usage = await quota.usageToday(deps.quotaStore, ident);
        } catch (e) {
            usage = null;
        }
    }
    if (!user) return ok({ loggedIn: false, tier, limits, usage });
    return ok(publicProfile(user, limits, usage));
}

async function redeem(req, stores, deps, user) {
    const now = Date.now();
    const hourKey = `rl:rd:${user.id}:${Math.floor(now / 3600000)}`;
    if (await hitLimit(stores, hourKey, REDEEM_FAILS_PER_HOUR)) {
        return fail(429, '输错次数太多，请一小时后再试');
    }
    const invalid = async (msg) => {
        await bumpLimit(stores, hourKey);
        return fail(400, msg);
    };

    const norm = normalizeCode(req.body.code);
    if (!norm) return invalid('兑换码格式不正确');
    const hash = codeHash(norm);
    const code = await stores.accounts.get(`c:${hash}`);
    if (!code || code.disabled) return invalid('兑换码无效或已作废');
    if (code.expiresAt && now > code.expiresAt) return fail(400, '兑换码已过期');
    user.redeemed = user.redeemed || [];
    if (user.redeemed.includes(hash)) return fail(400, '你已经用过这个兑换码了');

    if (code.maxUses === 1) {
        const claimed = await stores.accounts.create(`cl:${hash}`, { u: user.id, at: now });
        if (!claimed) return fail(400, '兑换码已被使用');
        code.usedBy = user.id;
    } else if (code.uses >= code.maxUses) {
        return fail(400, '兑换码已被领完');
    }
    code.uses = (code.uses || 0) + 1;
    code.lastUsedAt = now;
    await stores.accounts.set(`c:${hash}`, code);

    let message;
    if (code.type === 'days') {
        addMemberDays(user, code.amount, now);
        message = `已开通 ${code.amount} 天会员`;
    } else {
        user.credits = (user.credits || 0) + code.amount;
        message = `已到账 ${code.amount} 次 AI 解卦`;
    }
    user.redeemed.push(hash);
    if (user.redeemed.length > 200) user.redeemed = user.redeemed.slice(-200);
    await saveUser(stores, user);
    if (deps.bump) await deps.bump(['redeem']);
    return ok({ message, memberUntil: isMember(user) ? user.memberUntil : null, credits: user.credits || 0 });
}

// ------------------------------------------
// 卦历
// ------------------------------------------

function historySummary(item) {
    const hex = item.hexagramData || {};
    return {
        id: item.id,
        ts: item.ts,
        question: String(item.question || '').slice(0, 80),
        main: (hex.main && hex.main.name) || '',
        changed: (hex.changed && hex.changed.name) || '',
        followups: (item.followups || []).length
    };
}

async function historySave(req, stores, deps, user) {
    const raw = req.body.item || {};
    const id = quota.cleanId(raw.id, 40);
    if (!id || !raw.hexagramData || !raw.question) return fail(400, '缺少必要参数');
    const followups = Array.isArray(raw.followups) ? raw.followups.slice(0, 20).map((f) => ({
        q: String((f && f.q) || '').slice(0, 500),
        a: String((f && f.a) || '').slice(0, 20000)
    })) : [];
    const item = {
        id,
        ts: Number(raw.ts) || Date.now(),
        question: String(raw.question).slice(0, 500),
        hexagramData: raw.hexagramData,
        interpretation: String(raw.interpretation || '').slice(0, 40000),
        followups
    };
    if (Buffer.byteLength(JSON.stringify(item)) > HISTORY_MAX_BYTES) return fail(413, '内容过长，未能保存');

    await stores.history.set(`h:${user.id}:${id}`, item);
    const indexKey = `hi:${user.id}`;
    const index = ((await stores.history.get(indexKey)) || []).filter((s) => s.id !== id);
    index.unshift(historySummary(item));
    index.sort((a, b) => b.ts - a.ts);
    const dropped = index.splice(HISTORY_LIMIT);
    await stores.history.set(indexKey, index);
    await Promise.all(dropped.map((s) => stores.history.del(`h:${user.id}:${s.id}`)));
    return ok({ id });
}

async function historyList(req, stores, deps, user) {
    return ok({ items: (await stores.history.get(`hi:${user.id}`)) || [] });
}

async function historyGet(req, stores, deps, user) {
    const id = quota.cleanId(req.body.id, 40);
    const item = id && await stores.history.get(`h:${user.id}:${id}`);
    if (!item) return fail(404, '这条卦历不存在');
    return ok({ item });
}

async function historyDelete(req, stores, deps, user) {
    const id = quota.cleanId(req.body.id, 40);
    if (!id) return fail(400, '缺少必要参数');
    const indexKey = `hi:${user.id}`;
    const index = ((await stores.history.get(indexKey)) || []).filter((s) => s.id !== id);
    await stores.history.set(indexKey, index);
    await stores.history.del(`h:${user.id}:${id}`);
    return ok();
}

const PUBLIC_ACTIONS = { requestCode, verifyCode, logout };
const USER_ACTIONS = { redeem, historySave, historyList, historyGet, historyDelete };

/**
 * @param {{ action: string, body: object, cookie: string, ip: string, deviceId: string, secure: boolean }} req
 * @param {{ sendMail: Function, quotaStore?: object, bump?: (names: string[]) => Promise<void> }} deps
 * @returns {Promise<{ status: number, body: object, cookie?: string }>}
 */
async function handle(req, stores, deps) {
    req.body = req.body || {};
    req.deviceId = quota.cleanId(req.deviceId, 64);
    const action = req.action;
    try {
        if (PUBLIC_ACTIONS[action]) return await PUBLIC_ACTIONS[action](req, stores, deps);
        const user = await resolveUser(stores, req.cookie);
        if (action === 'me') return await me(req, stores, deps, user);
        if (USER_ACTIONS[action]) {
            if (!user) return fail(401, '请先登录');
            return await USER_ACTIONS[action](req, stores, deps, user);
        }
        return fail(400, '未知操作');
    } catch (e) {
        console.error(`账号接口 ${action} 失败:`, e);
        return fail(500, '服务暂时不可用，请稍后再试');
    }
}

// ------------------------------------------
// 管理后台
// ------------------------------------------

function parseDeadline(value) {
    if (!value) return null;
    const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    // 截止日当天北京时间 23:59:59 之前可兑换
    return Date.UTC(+m[1], +m[2] - 1, +m[3], 15, 59, 59);
}

async function adminGenerate(req, stores) {
    const b = req.body;
    const type = b.type === 'credits' ? 'credits' : 'days';
    const amount = parseInt(b.amount, 10);
    if (!(amount > 0 && amount <= 3650)) return fail(400, '数量需在 1～3650 之间');
    const batch = String(b.batch || '').trim().slice(0, 40) || '未命名批次';
    const batchId = randomFrom(CODE_ALPHABET, 8);
    const expiresAt = parseDeadline(b.expiresAt);
    const now = Date.now();
    const base = { type, amount, batch, batchId, createdAt: now, expiresAt, disabled: false, uses: 0 };

    if (b.campaignCode) {
        const norm = normalizeCode(b.campaignCode);
        if (!norm) return fail(400, '活动码只能用 4～32 位字母或数字');
        const maxUses = parseInt(b.maxUses, 10);
        if (!(maxUses > 0 && maxUses <= 100000)) return fail(400, '可用人数需在 1～100000 之间');
        const hash = codeHash(norm);
        if (await stores.accounts.get(`c:${hash}`)) return fail(400, '这个活动码已经存在');
        await stores.accounts.set(`c:${hash}`, Object.assign({}, base, { maxUses, campaign: true, display: norm }));
        return ok({ batchId, codes: [norm] });
    }

    const count = parseInt(b.count, 10);
    if (!(count > 0 && count <= 500)) return fail(400, '单批数量需在 1～500 之间');
    const codes = [];
    for (let i = 0; i < count; i++) {
        const norm = generateCode();
        await stores.accounts.set(`c:${codeHash(norm)}`, Object.assign({}, base, {
            maxUses: 1,
            campaign: false,
            display: maskCode(norm)
        }));
        codes.push(formatCode(norm));
    }
    return ok({ batchId, codes });
}

async function adminList(req, stores) {
    const keys = await stores.accounts.list('c:');
    const batches = {};
    for (const key of keys) {
        const c = await stores.accounts.get(key);
        if (!c) continue;
        const b = batches[c.batchId] || (batches[c.batchId] = {
            batchId: c.batchId,
            batch: c.batch,
            type: c.type,
            amount: c.amount,
            campaign: !!c.campaign,
            display: c.campaign ? c.display : '',
            createdAt: c.createdAt,
            expiresAt: c.expiresAt,
            codes: 0,
            capacity: 0,
            used: 0,
            disabled: 0
        });
        b.codes += 1;
        b.capacity += c.maxUses || 1;
        b.used += c.uses || 0;
        if (c.disabled) b.disabled += 1;
    }
    return ok({ batches: Object.values(batches).sort((a, b) => b.createdAt - a.createdAt) });
}

async function adminDisable(req, stores) {
    const { batchId, code } = req.body;
    let changed = 0;
    if (code) {
        const norm = normalizeCode(code);
        const key = norm && `c:${codeHash(norm)}`;
        const c = key && await stores.accounts.get(key);
        if (!c) return fail(404, '找不到这个兑换码');
        c.disabled = true;
        await stores.accounts.set(key, c);
        return ok({ changed: 1 });
    }
    if (!batchId) return fail(400, '缺少批次或兑换码');
    for (const key of await stores.accounts.list('c:')) {
        const c = await stores.accounts.get(key);
        if (c && c.batchId === batchId && !c.disabled) {
            c.disabled = true;
            await stores.accounts.set(key, c);
            changed += 1;
        }
    }
    return ok({ changed });
}

async function findUserByEmail(stores, raw) {
    const email = normalizeEmail(raw);
    if (!email) return null;
    const ref = await stores.accounts.get(`e:${hmac(email.canonical).slice(0, 32)}`);
    return ref ? loadUser(stores, ref.id) : null;
}

function adminUserView(user) {
    return {
        email: user.email,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt || null,
        tier: tierOf(user),
        memberUntil: user.memberUntil || null,
        credits: user.credits || 0,
        referralCount: user.referralCount || 0,
        referralDays: user.referralDays || 0
    };
}

async function adminGrant(req, stores) {
    const user = await findUserByEmail(stores, req.body.email);
    if (!user) return fail(404, '该邮箱尚未注册');
    const days = parseInt(req.body.days, 10) || 0;
    const credits = parseInt(req.body.credits, 10) || 0;
    if (days < 0 || credits < 0 || (!days && !credits)) return fail(400, '请填写要开通的天数或次数');
    if (days) addMemberDays(user, days);
    if (credits) user.credits = (user.credits || 0) + credits;
    await saveUser(stores, user);
    return ok({ user: adminUserView(user) });
}

async function adminUser(req, stores) {
    const user = await findUserByEmail(stores, req.body.email);
    if (!user) return fail(404, '该邮箱尚未注册');
    return ok({ user: adminUserView(user) });
}

const ADMIN_ACTIONS = {
    generate: adminGenerate,
    list: adminList,
    disable: adminDisable,
    grant: adminGrant,
    user: adminUser
};

/**
 * 未配置 ADMIN_TOKEN 时回退到 STATS_TOKEN；两者都没有时只有 allowWithoutToken（本地）放行
 */
function adminAuthorized(authHeader, allowWithoutToken) {
    const expected = process.env.ADMIN_TOKEN || process.env.STATS_TOKEN;
    if (!expected) return !!allowWithoutToken;
    const auth = String(authHeader || '');
    const got = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
    return !!got && safeEqual(got, expected);
}

async function handleAdmin(req, stores) {
    req.body = req.body || {};
    const fn = ADMIN_ACTIONS[req.action];
    if (!fn) return fail(400, '未知操作');
    try {
        return await fn(req, stores);
    } catch (e) {
        console.error(`管理接口 ${req.action} 失败:`, e);
        return fail(500, e.message || '服务暂时不可用');
    }
}

// ------------------------------------------
// Blobs 适配器
// ------------------------------------------

function blobsAdapter(store) {
    return {
        get: (key) => store.get(key, { type: 'json' }),
        set: (key, value) => store.setJSON(key, value),
        del: (key) => store.delete(key),
        create: async (key, value) => {
            const res = await store.setJSON(key, value, { onlyIfNew: true });
            return !res || res.modified !== false;
        },
        list: async (prefix) => {
            const { blobs } = await store.list({ prefix });
            return (blobs || []).map((b) => b.key);
        }
    };
}

function blobsStores(getStore) {
    return {
        accounts: blobsAdapter(getStore('accounts')),
        history: blobsAdapter(getStore('history'))
    };
}

module.exports = {
    handle,
    handleAdmin,
    adminAuthorized,
    resolveUser,
    safeResolveQuotaUser,
    spendCredit,
    normalizeEmail,
    normalizeCode,
    blobsStores
};
