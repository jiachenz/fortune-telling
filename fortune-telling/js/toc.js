/**
 * 解读目录 - 按解读中的 ## 标题生成跳转导航
 * ==========================================
 * 宽屏：内容左侧固定侧栏；窄屏：读到解读区域时吸顶的章节标签条
 */

class ReadingTocModule {
    constructor() {
        this.nav = null;
        this.list = null;
        this.source = null;
        this.followupSection = null;
        this.items = [];
        this.activeIndex = -1;
        this.onScroll = this.onScroll.bind(this);
        this.ticking = false;
        this.bound = false;
    }

    init(options) {
        this.nav = options.nav;
        this.list = options.list;
        this.source = options.source;
        this.followupSection = options.followupSection;
        if (this.nav && !this.bound) {
            this.bound = true;
            window.addEventListener('scroll', this.onScroll, { passive: true });
            window.addEventListener('resize', this.onScroll, { passive: true });
        }
    }

    reset() {
        this.items = [];
        this.activeIndex = -1;
        if (this.list) this.list.innerHTML = '';
        if (this.nav) this.nav.hidden = true;
    }

    build() {
        if (!this.nav || !this.list || !this.source) return;
        this.reset();

        const headings = Array.from(this.source.querySelectorAll('.markdown-content > h2'));
        headings.forEach((h, i) => {
            if (!h.id) h.id = `reading-sec-${i + 1}`;
            this.items.push({ label: h.textContent.trim(), target: h });
        });
        if (this.followupSection && !this.followupSection.hidden) {
            this.items.push({ label: '追问', target: this.followupSection });
        }
        if (this.items.length < 2) {
            this.items = [];
            return;
        }

        this.items.forEach((item) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'reading-toc-item';
            btn.textContent = item.label;
            btn.addEventListener('click', () => {
                item.target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            item.button = btn;
            this.list.appendChild(btn);
        });
        this.onScroll();
    }

    onScroll() {
        if (this.ticking) return;
        this.ticking = true;
        requestAnimationFrame(() => {
            this.ticking = false;
            this.update();
        });
    }

    update() {
        if (!this.nav || !this.items.length) return;
        const resultPage = document.getElementById('result-page');
        if (!resultPage || !resultPage.classList.contains('active')) {
            this.nav.hidden = true;
            return;
        }

        const first = this.items[0].target.getBoundingClientRect();
        const lastEl = this.followupSection && !this.followupSection.hidden ? this.followupSection : this.source;
        const last = lastEl.getBoundingClientRect();
        const vh = window.innerHeight;
        this.nav.hidden = !(first.top < vh * 0.6 && last.bottom > 80);
        if (this.nav.hidden) return;

        let active = 0;
        this.items.forEach((item, i) => {
            if (item.target.getBoundingClientRect().top <= 120) active = i;
        });
        if (active === this.activeIndex) return;
        this.activeIndex = active;
        this.items.forEach((item, i) => {
            item.button.classList.toggle('is-active', i === active);
        });
        const activeBtn = this.items[active].button;
        if (this.list.scrollWidth > this.list.clientWidth) {
            const left = activeBtn.offsetLeft - (this.list.clientWidth - activeBtn.offsetWidth) / 2;
            this.list.scrollTo({ left, behavior: 'smooth' });
        }
    }
}

window.ReadingTocModule = ReadingTocModule;
