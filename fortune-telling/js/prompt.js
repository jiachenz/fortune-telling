/**
 * 解卦提示词（浏览器 + Node 共用）
 * ==========================================
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.FortunePrompt = factory();
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const YAO_NAMES = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];

    function formatYaoDetails(yaoResults) {
        return (yaoResults || []).map((yao, i) => {
            const typeText = yao.type === 'yang' ? '阳爻' : '阴爻';
            const movingText = yao.moving ? '（动爻）' : '';
            return `${YAO_NAMES[i] || (i + 1) + '爻'}：${typeText}${movingText}`;
        }).join('\n');
    }

    function formatHexagramBlock(hexagramData, yaoResults) {
        const main = (hexagramData && hexagramData.main) || {};
        const changed = hexagramData && hexagramData.changed;
        const lines = [`本卦：${main.name || '未知'}`];

        if (main.trigramText) lines.push(`上下卦：${main.trigramText}`);
        if (main.nature) lines.push(`卦辞：${main.nature}`);

        if (changed && changed.name) {
            lines.push(`变卦：${changed.name}`);
            if (changed.trigramText) lines.push(`变卦上下卦：${changed.trigramText}`);
            if (changed.nature) lines.push(`变卦卦辞：${changed.nature}`);
        } else {
            lines.push('无动爻，不变卦');
        }

        if (hexagramData && hexagramData.hasMoving && Array.isArray(hexagramData.movingPositions)) {
            const moving = hexagramData.movingPositions
                .map((p) => YAO_NAMES[p - 1])
                .filter(Boolean)
                .join('、');
            if (moving) lines.push(`动爻位置：${moving}`);
        }

        if (hexagramData && hexagramData.ganzhi) {
            const g = hexagramData.ganzhi;
            lines.push('起卦日辰（六爻用时，不是出生八字）：');
            lines.push(`年柱 ${g.year || '—'} · 月建 ${g.month || '—'} · 日辰 ${g.day || '—'} · 时辰 ${g.hour || '—'}`);
            if (g.text) lines.push(`合文：${g.text}`);
        }

        lines.push('六爻详情（从初爻到上爻）：');
        lines.push(formatYaoDetails(yaoResults || (hexagramData && hexagramData.yaoResults)));
        return lines.join('\n');
    }

    function normalizeHistory(history) {
        if (!Array.isArray(history)) return [];
        return history.slice(-12).map((item) => ({
            role: item && item.role === 'assistant' ? 'assistant' : 'user',
            content: String(item && item.content != null ? item.content : '').slice(0, 8000)
        })).filter((item) => item.content.trim());
    }

    function normalizeFollowUp(followUp) {
        if (followUp == null) return '';
        return String(followUp).trim().slice(0, 500);
    }

    function buildSystemPrompt(options) {
        const followUp = options && options.followUp;
        const followUpExtra = followUp
            ? '\n你正在对同一卦作追问补充，不要重新起卦，也不要改口换成别的卦。只根据原卦和用户新补充的条件作答。篇幅可以比首解短，但结论、时间和依据一样都不能少。'
            : '';

        return `你是一位精通周易六爻的解卦者。解读既要合于易理，也要像一位清醒的顾问。读者大多不懂易经。

语气与边界：
- 给倾向，不给判决书。多用「倾向」「较可能」「需留意」「若继续则」，不用「就是」「一定会」「意味着结束」。
- 紧扣求问的字面含义，禁止题材升级。例如问逃课，不要写成结束学业；问吵架，不要写成分手；问一次面试，不要写成事业终结。
- 先点出依据：本卦对应当前处境、动爻对应转折、变卦对应趋向，再针对所问给建议。
- 起卦日辰是六爻的时间背景：月建看当月气势，日辰看当日旺衰与应期倾向。必须在「卦象总览」里用一两句点明，写到这四个字时用 **起卦日辰** 加粗，不要排成出生八字，也不要因此把事情说死。

说得具体：
- 问到「会不会」「能不能」「何时」，必须先给明确倾向：偏向会、偏向不会，或者五五开并说明取决于什么。
- 涉及时间就给时间窗口，例如「本月下旬」「未来两三周」「入冬前」，并说明是从月建、日辰或动爻哪一处推出的。给出倾向和时间不等于说死，用「较可能」表达即可。
- 不要只写「维持原状」「顺其自然」「静待时机」这类空话；若判断是维持，要说明大约维持多久、等到什么迹象出现才会变。

说得通俗：
- 五行生克、旺衰、月建、日辰、用神、世应、泄气、冲合等术语，在每段第一次出现时，紧跟一个括号写白话，不超过十五个字，例如「金气泄土（土的力量被消耗）」「月建（这个月的整体气势）」。
- 每段至少有一句不懂易经的人也能直接看懂的话，把象意翻译成对所问之事的实际含义。

格式：
- 使用 Markdown：## 标题、**加粗**、> 引用、- 列表。标题与加粗必须成对写完整，不要留下单独的 **。
- 直接输出 Markdown 正文，不要用 \`\`\` 代码块包裹全文；## 后面必须留一个空格再写标题。
${followUpExtra}`;
    }

    function buildUserPrompt(hexagramData, userQuestion, yaoResults, options) {
        const followUp = normalizeFollowUp(options && options.followUp);
        const history = normalizeHistory(options && options.history);
        const board = formatHexagramBlock(hexagramData, yaoResults);

        if (followUp) {
            const historyText = history.length
                ? history.map((m) => `${m.role === 'assistant' ? '解卦' : '求问'}：${m.content}`).join('\n\n')
                : '（暂无）';

            return `以下是同一卦的盘面，请不要另起新卦。

【卦盘】
${board}

【原问】
${userQuestion}

【此前对话】
${historyText}

【追问／补充条件】
${followUp}

请只针对这条追问作答，结构如下：
## 直接回答
一两句先给结论：明确倾向加时间窗口，例如「未来两三周较可能出现松动，但本月内大幅好转的可能偏小」。不要用「维持原状」「顺其自然」一笔带过。

## 卦象依据
两到四句，说明结论是从哪一爻、哪种生克、月建或日辰推出来的。术语第一次出现时带括号白话。

## 观察信号
- 一到两个现实中能看到的迹象：出现了，说明正在朝这个方向走
- 若出现……，说明判断需要修正

## 行动调整
- 一到三条针对这条追问的具体做法

紧扣原问与新条件，不要扩大议题。`;
        }

        return `请根据以下盘面为求卦者解答。

【求问之事】
${userQuestion}

【卦盘】
${board}

请用 Markdown 回答，结构如下：
## 卦象总览
用一两句说明本卦气象，点出上下卦。有动爻则说明动爻与变卦。再用一两句点出 **起卦日辰**（月建、日辰）对这卦的旺衰或应期倾向，明确这是六爻用时，不是排八字。写到「起卦日辰」这四个字时必须加粗。

## 针对所问
紧扣求问字面，把本卦／动爻／变卦分别对应到这个问题的处境、转折与趋向。不要扩大议题。
最后用一两句白话收束：这件事眼下偏向怎样，大约在什么时间窗口可能出现变化。

## 行动指引
- **宜**：具体可做的事
- **忌**：需要克制的事

## 智者箴言
> 用一句富有哲理的话作为总结：要紧扣这一卦和所问，像收束而不是判决，不要写成「自强不息」这类通用鸡汤。

语气温和，避免绝对断言。`;
    }

    return {
        buildSystemPrompt,
        buildUserPrompt,
        normalizeHistory,
        normalizeFollowUp,
        formatHexagramBlock
    };
}));
