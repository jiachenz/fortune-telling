/**
 * 周易六爻铜钱占卜 - 主程序
 * ==========================
 * 协调各模块之间的交互
 */

// ========================================
// 应用状态
// ========================================

const state = {
    currentPage: 'welcome',
    userQuestion: '',
    currentHexagramData: null,  // 当前卦象数据
    currentInterpretation: ''   // 当前解读内容
};

let isMobileDevice = false;

function checkDeviceType() {
    isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
}

// ========================================
// 摇一摇检测逻辑
// ========================================

let lastShakeTime = 0;
const SHAKE_THRESHOLD = 15;
let lastX = null, lastY = null, lastZ = null;

function handleDeviceMotion(event) {
    if (!coinModule || coinModule.isFlipping || coinModule.throwCount >= 6 || state.currentPage !== 'coin') return;

    const acceleration = event.accelerationIncludingGravity;
    if (!acceleration) return;

    const currentX = acceleration.x;
    const currentY = acceleration.y;
    const currentZ = acceleration.z;

    if (lastX !== null && lastY !== null && lastZ !== null) {
        const deltaX = Math.abs(currentX - lastX);
        const deltaY = Math.abs(currentY - lastY);
        const deltaZ = Math.abs(currentZ - lastZ);

        if (deltaX > SHAKE_THRESHOLD || deltaY > SHAKE_THRESHOLD || deltaZ > SHAKE_THRESHOLD) {
            const now = Date.now();
            if (now - lastShakeTime > 2000) { // 防抖，2秒内只触发一次
                lastShakeTime = now;
                handleThrowClick();
            }
        }
    }

    lastX = currentX;
    lastY = currentY;
    lastZ = currentZ;
}

function setupShakeEvent() {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        // iOS 13+ 必须由用户手势触发请求
        DeviceMotionEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    window.addEventListener('devicemotion', handleDeviceMotion, false);
                }
            })
            .catch(console.error);
    } else {
        // 其他设备直接监听
        window.addEventListener('devicemotion', handleDeviceMotion, false);
    }
}

// ========================================
// 模块实例
// ========================================

let coinModule = null;
let apiModule = null;
let rendererModule = null;
let pngExportModule = null;
let dailyTipsModule = null;
let shareModule = null;
let appStorage = null;

// ========================================
// DOM 元素
// ========================================

const elements = {
    // 页面
    welcomePage: null,
    coinPage: null,
    resultPage: null,
    
    // 欢迎页
    userQuestion: null,
    startBtn: null,
    dailyTipCard: null,
    
    // 铜钱页
    currentThrow: null,
    coins: [],
    throwResult: null,
    throwBtn: null,
    yaoLines: [],
    
    // 结果页
    hexagramVisual: null,
    hexagramName: null,
    hexagramNature: null,
    displayQuestion: null,
    aiResponse: null,
    restartBtn: null,
    exportPngBtn: null,
    
    // 模态框
    apiModal: null,
    apiKey: null,
    apiBase: null,
    modelName: null,
    saveApiBtn: null,
    skipApiBtn: null
};

// ========================================
// 初始化 DOM 元素
// ========================================

function initElements() {
    elements.welcomePage = document.getElementById('welcome-page');
    elements.coinPage = document.getElementById('coin-page');
    elements.resultPage = document.getElementById('result-page');
    
    elements.userQuestion = document.getElementById('user-question');
    elements.startBtn = document.getElementById('start-btn');
    elements.dailyTipCard = document.getElementById('daily-tip-card');
    
    elements.currentThrow = document.getElementById('current-throw');
    elements.coins = [
        document.getElementById('coin-1'),
        document.getElementById('coin-2'),
        document.getElementById('coin-3')
    ];
    elements.throwResult = document.getElementById('throw-result');
    elements.throwBtn = document.getElementById('throw-btn');
    elements.yaoLines = [
        document.getElementById('yao-1'),
        document.getElementById('yao-2'),
        document.getElementById('yao-3'),
        document.getElementById('yao-4'),
        document.getElementById('yao-5'),
        document.getElementById('yao-6')
    ];
    
    elements.hexagramVisual = document.getElementById('hexagram-visual');
    elements.hexagramName = document.getElementById('hexagram-name');
    elements.hexagramNature = document.getElementById('hexagram-nature');
    elements.displayQuestion = document.getElementById('display-question');
    elements.aiResponse = document.getElementById('ai-response');
    elements.restartBtn = document.getElementById('restart-btn');
    elements.exportPngBtn = document.getElementById('export-png-btn');
    
    elements.apiModal = document.getElementById('api-modal');
    elements.apiKey = document.getElementById('api-key');
    elements.apiBase = document.getElementById('api-base');
    elements.modelName = document.getElementById('model-name');
    elements.saveApiBtn = document.getElementById('save-api-btn');
    elements.skipApiBtn = document.getElementById('skip-api-btn');
}

// ========================================
// 初始化模块
// ========================================

function initModules() {
    const defaultHint = isMobileDevice ? '摇晃手机或点击下方按钮掷出铜钱' : '点击上方硬币区域掷出铜钱';
    
    // 初始化铜钱模块
    coinModule = new CoinModule();
    coinModule.init({
        coins: elements.coins,
        yaoLines: elements.yaoLines,
        throwResult: elements.throwResult,
        throwBtn: elements.throwBtn,
        currentThrow: elements.currentThrow,
        defaultHintText: defaultHint,
        onComplete: handleHexagramComplete
    });
    
    // 初始化 API 模块
    apiModule = new ApiModule();
    apiModule.loadConfig();
    
    // 初始化渲染模块
    rendererModule = new RendererModule();
    rendererModule.init({
        aiResponse: elements.aiResponse,
        hexagramVisual: elements.hexagramVisual,
        hexagramName: elements.hexagramName,
        hexagramNature: elements.hexagramNature,
        displayQuestion: elements.displayQuestion
    });
    
    // 初始化截图导出模块
    pngExportModule = new PngExportModule();

    // 初始化每日一易
    dailyTipsModule = new DailyTipsModule();
    dailyTipsModule.init({
        card: elements.dailyTipCard,
        questionInput: elements.userQuestion
    });
    // 暴露给分享模块使用（let 声明不会自动挂到 window 上）
    window.dailyTipsModule = dailyTipsModule;

    // 初始化本地存储 + 轻身份
    appStorage = new StorageModule();
    window.appStorage = appStorage;

    // 初始化分享模块
    shareModule = new ShareModule();
    shareModule.init();
}

// ========================================
// 页面切换
// ========================================

function showPage(pageName) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    const targetPage = document.getElementById(`${pageName}-page`);
    if (targetPage) {
        setTimeout(() => {
            targetPage.classList.add('active');
        }, 50);
    }

    // 贴底浮动分享条只在结果页出现
    const stickyBar = document.getElementById('share-sticky-bar');
    if (stickyBar) stickyBar.hidden = (pageName !== 'result');

    state.currentPage = pageName;
}

// ========================================
// 事件处理
// ========================================

function handleStartClick() {
    const question = elements.userQuestion.value.trim();
    if (!question) {
        elements.userQuestion.focus();
        elements.userQuestion.classList.add('shake');
        setTimeout(() => elements.userQuestion.classList.remove('shake'), 500);
        return;
    }
    state.userQuestion = question;
    
    if (isMobileDevice) {
        setupShakeEvent();
    }
    
    showPage('coin');
}

function handleThrowClick() {
    coinModule.throwCoins();
}

async function handleHexagramComplete(hexagramData) {
    showPage('result');
    
    // 显示加载状态
    rendererModule.showLoading();
    
    // 渲染卦象图形和名称
    rendererModule.renderHexagramVisual(hexagramData.yaoResults);
    rendererModule.renderHexagramName(hexagramData);
    rendererModule.renderUserQuestion(state.userQuestion);

    // 裂变 & 留存：打卡、编号、埋点、文案、日志
    onDivinationComplete(hexagramData);

    // 检查 API 配置（后端代理或本地 Key）
    const config = apiModule.getConfig();
    
    if (config.useProxy || config.apiKey) {
        // 有可用的 API 配置，直接调用
        await fetchAIInterpretation(hexagramData);
    } else {
        // 没有配置，显示配置弹窗
        elements.apiModal.classList.add('active');
        
        elements.saveApiBtn.onclick = async () => {
            apiModule.saveConfig({
                apiKey: elements.apiKey.value.trim(),
                apiBase: elements.apiBase.value.trim(),
                model: elements.modelName.value.trim()
            });
            elements.apiModal.classList.remove('active');
            await fetchAIInterpretation(hexagramData);
        };
        
        elements.skipApiBtn.onclick = () => {
            elements.apiModal.classList.remove('active');
            showLocalInterpretation(hexagramData);
        };
    }
}

async function fetchAIInterpretation(hexagramData) {
    const config = apiModule.getConfig();
    
    // 优先使用流式响应
    if (config.useProxy && config.useStream) {
        await fetchAIInterpretationStream(hexagramData);
        return;
    }
    
    // 回退到普通请求
    const result = await apiModule.getInterpretation(
        hexagramData,
        state.userQuestion,
        hexagramData.yaoResults
    );
    
    if (result.success) {
        state.currentHexagramData = hexagramData;
        state.currentInterpretation = result.content;
        rendererModule.renderMarkdown(result.content);
    } else if (result.useLocal) {
        console.log('使用本地解读:', result.error);
        showLocalInterpretation(hexagramData);
    } else {
        rendererModule.showError(result.error);
        setTimeout(() => showLocalInterpretation(hexagramData), 1500);
    }
}

async function fetchAIInterpretationStream(hexagramData) {
    // 初始化流式渲染
    rendererModule.initStreamRender();
    
    const result = await apiModule.getInterpretationStream(
        hexagramData,
        state.userQuestion,
        hexagramData.yaoResults,
        // onChunk - 每次收到内容
        (chunk, fullContent) => {
            rendererModule.appendStreamContent(chunk);
        },
        // onComplete - 完成
        (fullContent) => {
            const finalContent = rendererModule.finishStreamRender();
            state.currentHexagramData = hexagramData;
            state.currentInterpretation = finalContent;
            console.log('流式响应完成');
        },
        // onError - 错误
        (error) => {
            console.error('流式响应错误:', error);
        }
    );
    
    // 如果流式失败，使用本地解读
    if (!result.success) {
        console.log('流式响应失败，使用本地解读');
        showLocalInterpretation(hexagramData);
    }
}

function showLocalInterpretation(hexagramData) {
    const interpretation = apiModule.generateLocalInterpretation(
        hexagramData,
        state.userQuestion,
        hexagramData.yaoResults
    );
    // 保存当前卦象和解读用于导出
    state.currentHexagramData = hexagramData;
    state.currentInterpretation = interpretation;
    rendererModule.renderMarkdown(interpretation);
}

function handleRestartClick() {
    // 重置状态
    state.userQuestion = '';
    state.currentHexagramData = null;
    state.currentInterpretation = '';
    
    // 重置模块
    coinModule.reset();
    
    // 重置 UI
    elements.userQuestion.value = '';
    elements.throwBtn.onclick = handleThrowClick;
    
    if (!isMobileDevice) {
        elements.throwBtn.style.display = 'none';
    }
    
    // 返回欢迎页
    showPage('welcome');
}

// 导出长图
async function handleExportPng() {
    if (!state.currentHexagramData || !state.currentInterpretation) {
        alert('暂无可导出的内容');
        return;
    }
    
    // 更新按钮状态
    const btn = elements.exportPngBtn;
    const originalText = btn.querySelector('.btn-text').textContent;
    btn.querySelector('.btn-text').textContent = '导出中...';
    btn.disabled = true;
    
    try {
        await pngExportModule.exportToPng(
            state.currentHexagramData,
            state.userQuestion,
            state.currentInterpretation
        );
    } finally {
        btn.querySelector('.btn-text').textContent = originalText;
        btn.disabled = false;
    }
}

// ========================================
// 裂变 & 留存
// ========================================

// 一次起卦完成后：打卡 + 编号 + 埋点 + 文案 + 日志
function onDivinationComplete(hexagramData) {
    state.currentHexagramData = hexagramData;

    if (window.Analytics) window.Analytics.track('result_view');

    // 打卡（连续观易天数）
    let checkin = null;
    if (appStorage) {
        checkin = appStorage.checkIn();
        refreshStreakChip();
    }

    // 决策日志（本机私密留存）
    if (appStorage) {
        appStorage.addJournal({
            question: state.userQuestion,
            main: hexagramData.main && hexagramData.main.name,
            changed: hexagramData.changed && hexagramData.changed.name,
            advice: ''
        });
    }

    // 今日求卦编号（全局计数）
    updateDailyNumber();

    // 一键分享文案
    renderShareCopies(hexagramData);

    // 达成新里程碑 → 邀请生成成就卡
    if (checkin && checkin.newMilestone) {
        showStreakMilestone(checkin.streak, checkin.newMilestone);
    }
}

// 请求全局编号并展示「今日第 N 位求卦者」
async function updateDailyNumber() {
    const box = document.getElementById('daily-number');
    const rankEl = document.getElementById('daily-rank-value');
    const timesEl = document.getElementById('daily-times-value');
    if (!box || !rankEl || !timesEl) return;
    try {
        const res = await fetch('/api/counter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId: appStorage ? appStorage.getDeviceId() : null })
        });
        const data = await res.json();
        const rank = data.rank != null ? data.rank : data.today;
        const times = data.times;
        if (rank != null) {
            rankEl.textContent = rank;
            timesEl.textContent = times != null ? times : '—';
            box.hidden = false;
        }
    } catch (e) {
        // 无后端（如纯静态本地）时静默隐藏
    }
}

// 打开「分享这一卦」（结果卡，卦象符号+卦名，不含所问）——供结果页按钮与浮动条复用
function openResultShare() {
    if (!shareModule) return;
    const h = state.currentHexagramData;
    shareModule.open({
        cardType: 'result',
        ref: 'result',
        title: '分享这一卦',
        hint: '把卦象转给懂的人（不含你的所问）',
        cardData: h ? {
            symbol: h.main && h.main.symbol,
            name: h.main && h.main.name,
            changedName: h.changed && h.changed.name,
            advice: h.main && h.main.nature
        } : {}
    });
}

// 生成结果页的一键分享文案
function renderShareCopies(hexagramData) {
    const section = document.getElementById('share-copy-section');
    const list = document.getElementById('share-copy-list');
    if (!section || !list) return;

    const name = (hexagramData.main && hexagramData.main.name) || '此卦';
    const url = shareModule ? shareModule.buildShareUrl({ ref: 'copy' }) : location.href;

    const copies = [
        `我刚摇到「${name}」卦，竟然有点准…你最近是不是也有拿不定的事？点开摇一卦看看 👉 ${url}`,
        `与其反复纠结，不如问一卦。我抽到了「${name}」，分享给同样在做选择的你： ${url}`,
        `【${name}】今天为自己摇了一卦，心里清楚了不少。免费的，你也静心试试 👉 ${url}`
    ];

    list.innerHTML = '';
    copies.forEach((text) => {
        const item = document.createElement('div');
        item.className = 'share-copy-item';
        item.innerHTML = `<span class="copy-text"></span><span class="copy-icon">点击复制</span>`;
        item.querySelector('.copy-text').textContent = text;
        item.addEventListener('click', () => {
            if (shareModule) {
                shareModule.copyText(text, '文案已复制，去粘贴分享吧');
                if (window.Analytics) window.Analytics.track('share_click', { cardType: 'copy' });
            }
        });
        list.appendChild(item);
    });

    section.hidden = false;
}

// 刷新欢迎页的连续打卡 chip
function refreshStreakChip() {
    const chip = document.getElementById('streak-chip');
    const daysEl = document.getElementById('streak-chip-days');
    if (!chip || !daysEl || !appStorage) return;
    const streak = appStorage.getStreak();
    if (streak > 0) {
        daysEl.textContent = streak;
        chip.hidden = false;
    } else {
        chip.hidden = true;
    }
}

// 展示里程碑弹窗
function showStreakMilestone(streak, milestone) {
    const modal = document.getElementById('streak-modal');
    const title = document.getElementById('streak-modal-title');
    const desc = document.getElementById('streak-modal-desc');
    if (!modal) return;
    const names = { 7: '七日来复', 21: '二十一天养成', 49: '七七四十九' };
    if (title) title.textContent = `连续观易 ${streak} 天 · ${names[milestone] || milestone + '天'}`;
    if (desc) desc.textContent = '坚持不易，把这份坚持晒出去吧';
    modal._milestone = { streak, milestone, name: names[milestone] };
    modal.classList.add('active');
}

// 分享打卡成就卡
function openStreakShare(milestoneInfo) {
    if (!shareModule || !appStorage) return;
    const streak = appStorage.getStreak();
    shareModule.open({
        cardType: 'streak',
        ref: 'streak',
        title: '晒晒我的坚持',
        hint: '连续观易，日日精进',
        cardData: {
            streak,
            milestone: milestoneInfo ? milestoneInfo.milestone : null,
            milestoneName: milestoneInfo ? milestoneInfo.name : null
        }
    });
}

// 欢迎页：处理「替朋友求一卦」落地参数
function handleInviteParams() {
    let params;
    try {
        params = new URLSearchParams(location.search);
    } catch (e) {
        return;
    }
    const forName = params.get('for');
    const topic = params.get('topic');
    if (!forName) return;

    const banner = document.getElementById('invite-banner');
    const title = document.getElementById('invite-banner-title');
    const sub = document.getElementById('invite-banner-sub');
    if (banner) {
        if (title) title.textContent = `${forName}，有人为你求了一卦`;
        if (sub) sub.textContent = topic ? `关于「${topic}」，静心片刻，亲自摇一卦` : '静心片刻，亲自摇一卦';
        banner.hidden = false;
    }
    // 预填问题
    if (topic && elements.userQuestion && !elements.userQuestion.value) {
        elements.userQuestion.value = `关于${topic}，我近期该如何应对？`;
    }
}

// ========================================
// 事件绑定
// ========================================

function bindEvents() {
    // 开始按钮
    elements.startBtn.addEventListener('click', handleStartClick);
    
    // 回车键提交
    elements.userQuestion.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            elements.startBtn.click();
        }
    });
    
    // 投掷按钮
    elements.throwBtn.addEventListener('click', handleThrowClick);
    
    // 重新开始
    elements.restartBtn.addEventListener('click', handleRestartClick);
    
    // 导出长图
    elements.exportPngBtn.addEventListener('click', handleExportPng);

    // 分享给朋友 · 欢迎页（品牌卡，可公开晒）
    const shareWelcomeBtn = document.getElementById('share-app-btn-welcome');
    if (shareWelcomeBtn) {
        shareWelcomeBtn.addEventListener('click', () => {
            if (shareModule) shareModule.open({ cardType: 'brand', ref: 'brand' });
        });
    }

    // 分享这一卦 · 结果页（结果卡，卦象符号+卦名，不含所问，偏私密）
    const shareResultBtn = document.getElementById('share-app-btn');
    if (shareResultBtn) shareResultBtn.addEventListener('click', openResultShare);

    // 贴底浮动分享条
    const shareStickyBtn = document.getElementById('share-sticky-btn');
    if (shareStickyBtn) shareStickyBtn.addEventListener('click', openResultShare);

    // 连续打卡 chip → 晒成就卡
    const streakChip = document.getElementById('streak-chip');
    if (streakChip) streakChip.addEventListener('click', () => openStreakShare(null));

    // 里程碑弹窗
    const streakModal = document.getElementById('streak-modal');
    const streakShareBtn = document.getElementById('streak-share-btn');
    const streakLaterBtn = document.getElementById('streak-later-btn');
    const streakCloseBtn = document.getElementById('streak-modal-close');
    const closeStreakModal = () => streakModal && streakModal.classList.remove('active');
    if (streakShareBtn) {
        streakShareBtn.addEventListener('click', () => {
            const info = streakModal ? streakModal._milestone : null;
            closeStreakModal();
            openStreakShare(info);
        });
    }
    if (streakLaterBtn) streakLaterBtn.addEventListener('click', closeStreakModal);
    if (streakCloseBtn) streakCloseBtn.addEventListener('click', closeStreakModal);
    if (streakModal) streakModal.addEventListener('click', (e) => { if (e.target === streakModal) closeStreakModal(); });

    // 替朋友求一卦
    const friendBtn = document.getElementById('friend-invite-btn');
    const inviteModal = document.getElementById('invite-modal');
    const inviteName = document.getElementById('invite-name');
    const inviteTopic = document.getElementById('invite-topic');
    const inviteGenBtn = document.getElementById('invite-generate-btn');
    const inviteCancelBtn = document.getElementById('invite-cancel-btn');
    const inviteCloseBtn = document.getElementById('invite-modal-close');
    const closeInviteModal = () => inviteModal && inviteModal.classList.remove('active');
    if (friendBtn) {
        friendBtn.addEventListener('click', () => {
            if (inviteModal) inviteModal.classList.add('active');
            if (inviteName) inviteName.focus();
        });
    }
    if (inviteCancelBtn) inviteCancelBtn.addEventListener('click', closeInviteModal);
    if (inviteCloseBtn) inviteCloseBtn.addEventListener('click', closeInviteModal);
    if (inviteModal) inviteModal.addEventListener('click', (e) => { if (e.target === inviteModal) closeInviteModal(); });
    if (inviteGenBtn) {
        inviteGenBtn.addEventListener('click', () => {
            const name = (inviteName && inviteName.value.trim()) || '';
            const topic = (inviteTopic && inviteTopic.value.trim()) || '';
            if (!name) {
                if (inviteName) {
                    inviteName.focus();
                    inviteName.classList.add('shake');
                    setTimeout(() => inviteName.classList.remove('shake'), 500);
                }
                return;
            }
            const url = shareModule.buildShareUrl({ for: name, topic: topic || undefined, ref: 'invite' });
            closeInviteModal();
            shareModule.open({
                cardType: 'invite',
                url,
                ref: 'invite',
                title: '替朋友求一卦',
                hint: `把这张「给 ${name} 的卦」发给 TA`,
                cardData: { name, topic }
            });
        });
    }
    
    // PC/Mobile 差异化绑定
    if (!isMobileDevice) {
        // PC 端隐藏按钮，将事件绑定到硬币容器
        elements.throwBtn.style.display = 'none';
        
        const coinsContainer = document.querySelector('.coins-container');
        if (coinsContainer) {
            coinsContainer.addEventListener('click', handleThrowClick);
            coinsContainer.classList.add('pc-interactive');
        }
    }
}

// ========================================
// 添加抖动动画样式
// ========================================

function addShakeStyle() {
    const shakeStyle = document.createElement('style');
    shakeStyle.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20%, 60% { transform: translateX(-5px); }
            40%, 80% { transform: translateX(5px); }
        }
        .shake {
            animation: shake 0.5s ease;
            border-color: #c41e3a !important;
        }
    `;
    document.head.appendChild(shakeStyle);
}

// ========================================
// 填充 API 配置表单
// ========================================

function fillApiForm() {
    const config = apiModule.getConfig();
    if (elements.apiKey) elements.apiKey.value = config.apiKey || '';
    if (elements.apiBase) elements.apiBase.value = config.apiBase || 'https://api.siliconflow.cn/v1';
    if (elements.modelName) elements.modelName.value = config.model || 'Pro/zai-org/GLM-4.7';
}

// ========================================
// 初始化应用
// ========================================

async function init() {
    checkDeviceType();
    initElements();
    
    // 提前更新文本，以免出现闪烁
    if (elements.throwResult) {
        const resultSpan = elements.throwResult.querySelector('.result-text');
        if (resultSpan) {
            resultSpan.textContent = isMobileDevice ? '摇晃手机或点击下方按钮掷出铜钱' : '点击上方硬币区域掷出铜钱';
        }
    }
    
    initModules();
    bindEvents();
    addShakeStyle();

    // 裂变 & 留存初始化：访问计数、来源落地、邀请落地、打卡 chip
    if (appStorage) appStorage.recordVisit();
    if (window.Analytics) {
        window.Analytics.initRef();
        window.Analytics.trackLandingIfReferred();
    }
    handleInviteParams();
    refreshStreakChip();

    // 检查后端代理是否可用
    const proxyAvailable = await apiModule.checkProxyAvailable();
    console.log('后端代理状态:', proxyAvailable ? '可用' : '不可用');
    
    // 如果后端代理可用，隐藏 API 配置相关提示
    if (proxyAvailable) {
        console.log('使用后端代理模式，API Key 已在服务器配置');
    } else {
        fillApiForm();
    }
}

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', init);
