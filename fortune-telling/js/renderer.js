/**
 * 渲染模块 - 卦盘、Markdown、追问
 * ==========================================
 */

class RendererModule {
    constructor() {
        this.aiResponseElement = null;
        this.hexagramBoardElement = null;
        this.castMetaElement = null;
        this.boardLegendElement = null;
        this.displayQuestionElement = null;
        this.followupThreadElement = null;
        this.streamContainer = null;
        this.streamBuffer = '';
    }

    init(options) {
        this.aiResponseElement = options.aiResponse;
        this.hexagramBoardElement = options.hexagramBoard;
        this.castMetaElement = options.castMeta;
        this.boardLegendElement = options.boardLegend;
        this.displayQuestionElement = options.displayQuestion;
        this.followupThreadElement = options.followupThread;
    }

    escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    closeUnmatchedMarkdown(text) {
        if (!text) return '';
        let out = String(text);
        const boldMarks = out.match(/\*\*/g);
        if (boldMarks && boldMarks.length % 2 === 1) {
            out = out.replace(/\*\*(?![\s\S]*\*\*)/, '');
        }
        return out;
    }

    emphasizeGanzhiLabel(html) {
        return String(html || '').replace(/起卦日辰/g, (match, offset, src) => {
            const before = src.slice(0, offset);
            if (before.lastIndexOf('<strong') > before.lastIndexOf('</strong>')) return match;
            const lt = before.lastIndexOf('<');
            const gt = before.lastIndexOf('>');
            if (lt > gt) return match;
            return '<strong>起卦日辰</strong>';
        });
    }

    parseMarkdown(text, sanitize) {
        const source = sanitize ? this.closeUnmatchedMarkdown(text) : (text || '');
        const html = typeof marked !== 'undefined'
            ? (marked.setOptions({ breaks: true, gfm: true }), marked.parse(source))
            : this.escapeHtml(source).replace(/\n/g, '<br>');
        return this.emphasizeGanzhiLabel(html);
    }

    yaoClass(yao) {
        if (yao.moving) return yao.type === 'yang' ? 'yang-moving' : 'yin-moving';
        if (yao.wasMoving) return yao.type === 'yang' ? 'yang yao-changed' : 'yin yao-changed';
        return yao.type;
    }

    yaoVisualHtml(yaoResults) {
        const lines = [];
        for (let i = 5; i >= 0; i--) {
            const yao = yaoResults[i];
            if (!yao) continue;
            lines.push(`<div class="yao-line ${this.yaoClass(yao)}"></div>`);
        }
        return lines.join('');
    }

    yaoListHtml(yaoResults) {
        const names = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];
        return `<ul class="hex-yao-list">${yaoResults.map((yao, i) => {
            const moving = yao.moving ? '<span class="hex-yao-badge">动</span>' : '';
            const changed = yao.wasMoving ? '<span class="hex-yao-badge muted">变</span>' : '';
            const typeText = yao.type === 'yang' ? '阳' : '阴';
            return `<li class="${yao.moving ? 'is-moving' : ''} ${yao.wasMoving ? 'is-changed' : ''}">
                <span>${names[i]}</span>
                <span>${typeText}${moving}${changed}</span>
            </li>`;
        }).join('')}</ul>`;
    }

    hexColumnHtml(hex, yaoResults, kicker, hint) {
        const name = this.escapeHtml(hex && hex.name);
        const trigram = this.escapeHtml(hex && (hex.trigramText || hex.symbol || ''));
        const nature = this.escapeHtml(hex && hex.nature);
        return `
            <div class="hex-column">
                <span class="hex-kicker">${this.escapeHtml(kicker)} · ${this.escapeHtml(hint)}</span>
                <div class="hex-visual">${this.yaoVisualHtml(yaoResults)}</div>
                <h3 class="hex-name">${name}</h3>
                ${trigram ? `<p class="hex-trigram">${trigram}</p>` : ''}
                ${nature ? `<p class="hex-nature">「${nature}」</p>` : ''}
                ${this.yaoListHtml(yaoResults)}
            </div>
        `;
    }

    changedYaoResults(yaoResults) {
        return (yaoResults || []).map((yao) => ({
            type: yao.moving ? (yao.type === 'yang' ? 'yin' : 'yang') : yao.type,
            moving: false,
            wasMoving: !!yao.moving
        }));
    }

    renderHexagramBoard(hexagramData) {
        if (!this.hexagramBoardElement || !hexagramData) return;

        const mainHtml = this.hexColumnHtml(
            hexagramData.main,
            hexagramData.yaoResults || [],
            '本卦',
            '当前处境'
        );

        let changedHtml;
        if (hexagramData.changed) {
            changedHtml = this.hexColumnHtml(
                hexagramData.changed,
                this.changedYaoResults(hexagramData.yaoResults),
                '变卦',
                '变化趋向'
            );
            this.hexagramBoardElement.classList.remove('single');
        } else {
            changedHtml = `
                <div class="hex-column hex-column-quiet">
                    <span class="hex-kicker">变卦 · 尚未起变</span>
                    <p class="hex-quiet-copy">六爻安静，事态未起变。先把本卦当作当前处境来看。</p>
                </div>
            `;
            this.hexagramBoardElement.classList.add('single');
        }

        this.hexagramBoardElement.innerHTML = mainHtml + changedHtml;

        if (this.boardLegendElement) {
            this.boardLegendElement.textContent = hexagramData.changed
                ? '本卦看处境 · 动爻看转折 · 变卦看趋向'
                : '本卦看处境 · 六爻安静，先守住当下';
        }

        this.renderCastMeta(hexagramData);
    }

    renderCastMeta(hexagramData) {
        if (!this.castMetaElement) return;
        const g = hexagramData && hexagramData.ganzhi;
        if (!g) {
            this.castMetaElement.hidden = true;
            this.castMetaElement.innerHTML = '';
            return;
        }
        this.castMetaElement.hidden = false;
        this.castMetaElement.innerHTML = `
            <span class="cast-meta-label">起卦日辰</span>
            <span>${this.escapeHtml(g.year)}年</span>
            <span>${this.escapeHtml(g.month)}月</span>
            <span>${this.escapeHtml(g.day)}日</span>
            <span>${this.escapeHtml(g.hour)}时</span>
        `;
    }

    renderUserQuestion(question) {
        if (this.displayQuestionElement) {
            this.displayQuestionElement.textContent = question;
        }
    }

    showLoading() {
        if (!this.aiResponseElement) return;
        this.aiResponseElement.innerHTML = `
            <div class="loading-indicator">
                <div class="loading-spinner"></div>
                <span>天机推演中...</span>
            </div>
        `;
    }

    showError(message) {
        if (!this.aiResponseElement) return;
        this.aiResponseElement.innerHTML = `
            <div class="ai-error">AI解卦服务暂时不可用：${this.escapeHtml(message)}</div>
        `;
    }

    renderMarkdown(text) {
        if (!this.aiResponseElement) return;
        this.aiResponseElement.innerHTML = `<div class="markdown-content">${this.parseMarkdown(text, true)}</div>`;
    }

    initStreamRender() {
        if (!this.aiResponseElement) return;
        this.streamBuffer = '';
        this.aiResponseElement.innerHTML = '<div class="markdown-content stream-content"></div>';
        this.streamContainer = this.aiResponseElement.querySelector('.markdown-content');
        if (typeof marked !== 'undefined') {
            marked.setOptions({ breaks: true, gfm: true });
        }
    }

    appendStreamContent(chunk) {
        if (!this.streamContainer) return;
        this.streamBuffer += chunk;
        this.streamContainer.innerHTML = this.parseMarkdown(this.streamBuffer);
        this.streamContainer.scrollIntoView({ block: 'nearest' });
    }

    finishStreamRender() {
        if (this.streamContainer) {
            this.streamBuffer = this.closeUnmatchedMarkdown(this.streamBuffer);
            this.streamContainer.classList.add('finished');
            this.streamContainer.innerHTML = this.parseMarkdown(this.streamBuffer, true);
        }
        return this.streamBuffer;
    }

    getStreamContent() {
        return this.streamBuffer;
    }

    resetFollowUpThread() {
        if (this.followupThreadElement) this.followupThreadElement.innerHTML = '';
        this.streamContainer = null;
        this.streamBuffer = '';
    }

    appendFollowUpUser(text) {
        if (!this.followupThreadElement) return;
        const el = document.createElement('div');
        el.className = 'followup-turn followup-user';
        const label = document.createElement('span');
        label.className = 'followup-label';
        label.textContent = '追问';
        const body = document.createElement('p');
        body.textContent = text;
        el.appendChild(label);
        el.appendChild(body);
        this.followupThreadElement.appendChild(el);
    }

    initFollowUpStream() {
        if (!this.followupThreadElement) return;
        const wrap = document.createElement('div');
        wrap.className = 'followup-turn followup-assistant';
        const label = document.createElement('span');
        label.className = 'followup-label';
        label.textContent = '补解';
        const content = document.createElement('div');
        content.className = 'markdown-content stream-content';
        wrap.appendChild(label);
        wrap.appendChild(content);
        this.followupThreadElement.appendChild(wrap);
        this.streamBuffer = '';
        this.streamContainer = content;
        if (typeof marked !== 'undefined') {
            marked.setOptions({ breaks: true, gfm: true });
        }
        wrap.scrollIntoView({ block: 'nearest' });
    }

    renderFollowUpMarkdown(text) {
        if (!this.streamContainer) this.initFollowUpStream();
        if (!this.streamContainer) return;
        this.streamBuffer = text;
        this.streamContainer.classList.add('finished');
        this.streamContainer.innerHTML = this.parseMarkdown(text, true);
    }
}

window.RendererModule = RendererModule;
