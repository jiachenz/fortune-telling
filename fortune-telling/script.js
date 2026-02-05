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

// ========================================
// 模块实例
// ========================================

let coinModule = null;
let apiModule = null;
let rendererModule = null;
let pdfExportModule = null;

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
    exportPdfBtn: null,
    
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
    elements.exportPdfBtn = document.getElementById('export-pdf-btn');
    
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
    // 初始化铜钱模块
    coinModule = new CoinModule();
    coinModule.init({
        coins: elements.coins,
        yaoLines: elements.yaoLines,
        throwResult: elements.throwResult,
        throwBtn: elements.throwBtn,
        currentThrow: elements.currentThrow,
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
    
    // 初始化 PDF 导出模块
    pdfExportModule = new PdfExportModule();
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
    const result = await apiModule.getInterpretation(
        hexagramData,
        state.userQuestion,
        hexagramData.yaoResults
    );
    
    if (result.success) {
        // 保存当前卦象和解读用于导出
        state.currentHexagramData = hexagramData;
        state.currentInterpretation = result.content;
        rendererModule.renderMarkdown(result.content);
    } else {
        rendererModule.showError(result.error);
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
    
    // 返回欢迎页
    showPage('welcome');
}

// 导出 PDF
async function handleExportPdf() {
    if (!state.currentHexagramData || !state.currentInterpretation) {
        alert('暂无可导出的内容');
        return;
    }
    
    // 更新按钮状态
    const btn = elements.exportPdfBtn;
    const originalText = btn.querySelector('.btn-text').textContent;
    btn.querySelector('.btn-text').textContent = '导出中...';
    btn.disabled = true;
    
    try {
        await pdfExportModule.exportToPdf(
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
    
    // 导出 PDF
    elements.exportPdfBtn.addEventListener('click', handleExportPdf);
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
    initElements();
    initModules();
    bindEvents();
    addShakeStyle();
    
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
