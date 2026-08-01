/**
 * 每日易经 Tips
 * 按星期匹配主题，并在同一主题的三条内容中逐周轮换。
 */
class DailyTipsModule {
    constructor() {
        this.tips = [
            { theme: '决策', quote: '穷则变，变则通，通则久。', source: '《系辞下传》', explanation: '走不通的时候，变化就是出路；不要死守旧路。', action: '今天把卡住你的那件事，列出 3 个和现在不一样的做法。' },
            { theme: '决策', quote: '君子藏器于身，待时而动，何不利之有？', source: '《系辞下传》', explanation: '把本事准备好，等条件成熟再行动。', action: '如果今天有一个冲动的决定，先把条件列清楚，再决定是否出手。' },
            { theme: '决策', quote: '小狐汔济，濡其尾，无攸利。', source: '《未济卦》', explanation: '越接近完成，越容易因松懈而功亏一篑。', action: '检查一件快完成的事，找出最后阶段最可能掉链子的风险点。' },
            { theme: '时机', quote: '潜龙勿用。', source: '《乾卦·初九》', explanation: '条件不成熟时，再好的本事也应先积蓄力量。', action: '今天遇到需要表态的事，先观察更多信息再决定。' },
            { theme: '时机', quote: '君子见几而作，不俟终日。', source: '《系辞下传》', explanation: '看见微小而关键的征兆，就应及时回应。', action: '留意一个反复出现的小信号，今天为它采取一个最小行动。' },
            { theme: '时机', quote: '飞龙在天，利见大人。', source: '《乾卦·九五》', explanation: '条件成熟、位置有利时，应主动连接关键人物。', action: '约见一位能推动事情的人，把准备好的想法说清楚。' },
            { theme: '风险', quote: '君子安而不忘危，存而不忘亡。', source: '《系辞下传》', explanation: '越是顺利，越要保持对潜在风险的清醒。', action: '给当前最顺利的一件事找出一个隐藏风险，并准备应对方案。' },
            { theme: '风险', quote: '君子以思患而豫防之。', source: '《既济卦·象》', explanation: '事情即将完成时，更要提前想到可能发生的问题。', action: '在项目收尾前问一句：最坏情况是什么，我如何兜底？' },
            { theme: '风险', quote: '亢龙有悔。', source: '《乾卦·上九》', explanation: '走得太满、站得太高，往往会失去回旋余地。', action: '今天别把话说满、把承诺给满，为变化留出空间。' },
            { theme: '关系', quote: '二人同心，其利断金；同心之言，其臭如兰。', source: '《系辞上传》', explanation: '真正对齐目标的合作，会产生远超个人的力量。', action: '找一位关键协作者，主动确认一次共同目标和分工。' },
            { theme: '关系', quote: '观乎天文，以察时变；观乎人文，以化成天下。', source: '《贲卦·彖》', explanation: '既要观察局势，也要理解人心。', action: '在开会或沟通前，先想清楚对方最在意什么。' },
            { theme: '关系', quote: '上天下泽，履；君子以辨上下，定民志。', source: '《履卦·象》', explanation: '角色与边界清晰，合作关系才会稳定。', action: '处理一项分歧时，先明确角色和边界，再讨论情绪与方案。' },
            { theme: '心态', quote: '惧以终始，其要无咎。', source: '《系辞下传》', explanation: '保持敬畏与谨慎，重点不是求大吉，而是少犯错。', action: '把“必须成功”改成“尽量无咎”，找出今天最该避免的错误。' },
            { theme: '心态', quote: '无思也，无为也，寂然不动，感而遂通天下之故。', source: '《系辞上传》', explanation: '暂时放下杂念，才更容易感知事情的真实脉络。', action: '给自己 5 分钟静默，只问：我真正担心的是什么？' },
            { theme: '心态', quote: '君子以恐惧修省。', source: '《震卦·象》', explanation: '恐惧可以成为反省和调整自己的信号。', action: '写下最近的一项焦虑，区分真实风险与想象中的担忧。' },
            { theme: '行动', quote: '山下出泉，蒙；君子以果行育德。', source: '《蒙卦·象》', explanation: '像山泉冲破阻碍一样，在行动中培养能力与品格。', action: '挑一件拖延已久的小事，今天直接完成。' },
            { theme: '行动', quote: '天行健，君子以自强不息。', source: '《乾卦·象》', explanation: '持续行动比等待完美状态更重要。', action: '给今天设一条最低完成线，先动起来再逐步完善。' },
            { theme: '行动', quote: '君子以见善则迁，有过则改。', source: '《益卦·象》', explanation: '看见更好的做法就学习，发现错误就及时修正。', action: '复盘一个近期错误，写下下次遇到时的新做法。' },
            { theme: '复盘', quote: '君子居则观其象而玩其辞，动则观其变而玩其占。', source: '《系辞上传》', explanation: '静时观察规律，行动后再从变化中修正认识。', action: '回顾本周：哪件事的变化规律，你现在才看明白？' },
            { theme: '复盘', quote: '数往者顺，知来者逆。', source: '《说卦传》', explanation: '回顾过去要顺着脉络梳理，推想未来则要反向寻找条件。', action: '写一句“本周我学到”，再写一句“下周我要试”。' },
            { theme: '复盘', quote: '复，其见天地之心乎。', source: '《复卦·彖》', explanation: '一次重新开始，正体现了生生不息的力量。', action: '即使本周不顺，也找出一件值得重新尝试的小事。' }
        ];

        this.questions = {
            '决策': '面对当前卡住我的事情，我应该改变什么、保留什么？',
            '时机': '对于我正在考虑的事情，现在是行动的合适时机吗？',
            '风险': '我当前最需要留意和预防的风险是什么？',
            '关系': '我该如何改善当前最重要的一段合作或关系？',
            '心态': '我现在真正担心的是什么，该如何安定下来？',
            '行动': '为了推动当前目标，我下一步最应该做什么？',
            '复盘': '回看最近的经历，我最需要看懂的变化是什么？'
        };
    }

    getTodayTip(date = new Date()) {
        const dayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;
        const utcDay = Math.floor(Date.UTC(
            date.getFullYear(),
            date.getMonth(),
            date.getDate()
        ) / 86400000);
        const weeklyRotation = Math.floor(utcDay / 7) % 3;
        return this.tips[dayIndex * 3 + weeklyRotation];
    }

    init(options) {
        const card = options.card;
        const questionInput = options.questionInput;
        if (!card) return;

        const tip = this.getTodayTip();
        const weekday = ['日', '一', '二', '三', '四', '五', '六'][new Date().getDay()];

        card.querySelector('[data-tip-meta]').textContent = `周${weekday} · ${tip.theme}`;
        card.querySelector('[data-tip-quote]').textContent = `“${tip.quote}”`;
        card.querySelector('[data-tip-source]').textContent = `—— ${tip.source}`;
        card.querySelector('[data-tip-explanation]').textContent = tip.explanation;
        card.querySelector('[data-tip-action]').textContent = tip.action;

        const toggle = card.querySelector('[data-tip-toggle]');
        const toggleLabel = card.querySelector('[data-tip-toggle-label]');
        const details = card.querySelector('[data-tip-details]');
        toggle.addEventListener('click', () => {
            const expanded = toggle.getAttribute('aria-expanded') === 'true';
            toggle.setAttribute('aria-expanded', String(!expanded));
            details.hidden = expanded;
            toggleLabel.textContent = expanded ? '展开今日指引' : '收起今日指引';
        });

        const askButton = card.querySelector('[data-tip-question]');
        askButton.addEventListener('click', () => {
            if (!questionInput) return;
            questionInput.value = this.questions[tip.theme];
            questionInput.focus();
            questionInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    }
}

window.DailyTipsModule = DailyTipsModule;
