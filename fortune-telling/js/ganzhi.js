/**
 * 起卦干支 + 八经卦
 * ==========================================
 * 年月日时按节气近似（立春为年界，寅月起），供六爻日辰展示。
 * 不是出生八字排盘。
 */

(function (root) {
    const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
    const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

    const TRIGRAMS = {
        '111': { name: '乾', nature: '天', symbol: '☰' },
        '000': { name: '坤', nature: '地', symbol: '☷' },
        '100': { name: '震', nature: '雷', symbol: '☳' },
        '011': { name: '巽', nature: '风', symbol: '☴' },
        '010': { name: '坎', nature: '水', symbol: '☵' },
        '101': { name: '离', nature: '火', symbol: '☲' },
        '001': { name: '艮', nature: '山', symbol: '☶' },
        '110': { name: '兑', nature: '泽', symbol: '☱' }
    };

    // 节气近似日期：进入该地支月
    const SOLAR_TERMS = [
        { month: 1, day: 6, branch: 1 },
        { month: 2, day: 4, branch: 2 },
        { month: 3, day: 6, branch: 3 },
        { month: 4, day: 5, branch: 4 },
        { month: 5, day: 6, branch: 5 },
        { month: 6, day: 6, branch: 6 },
        { month: 7, day: 7, branch: 7 },
        { month: 8, day: 8, branch: 8 },
        { month: 9, day: 8, branch: 9 },
        { month: 10, day: 8, branch: 10 },
        { month: 11, day: 7, branch: 11 },
        { month: 12, day: 7, branch: 0 }
    ];

    function pillarFromIndex(index) {
        const i = ((index % 60) + 60) % 60;
        return STEMS[i % 10] + BRANCHES[i % 12];
    }

    function getMonthBranch(date) {
        const m = date.getMonth() + 1;
        const d = date.getDate();
        let branch = SOLAR_TERMS[SOLAR_TERMS.length - 1].branch;
        for (let i = 0; i < SOLAR_TERMS.length; i++) {
            const term = SOLAR_TERMS[i];
            if (m > term.month || (m === term.month && d >= term.day)) {
                branch = term.branch;
            }
        }
        return branch;
    }

    function getYearNumber(date) {
        const m = date.getMonth() + 1;
        const d = date.getDate();
        // 立春（约 2 月 4 日）为年柱分界
        if (m < 2 || (m === 2 && d < 4)) return date.getFullYear() - 1;
        return date.getFullYear();
    }

    function getYearIndex(year) {
        return ((year - 1984) % 60 + 60) % 60;
    }

    function monthCycleIndex(yearIndex, monthBranch) {
        const yearStem = yearIndex % 10;
        const yinStemByYearStem = [2, 4, 6, 8, 0, 2, 4, 6, 8, 0];
        const yinStem = yinStemByYearStem[yearStem];
        const offset = (monthBranch - 2 + 12) % 12;
        const stem = (yinStem + offset) % 10;
        // 60 甲子中同时满足天干 stem、地支 monthBranch
        for (let i = 0; i < 60; i++) {
            if (i % 10 === stem && i % 12 === monthBranch) return i;
        }
        return 0;
    }

    function getDayIndex(date) {
        const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
        const anchor = Date.UTC(2000, 0, 7); // 甲子日
        const days = Math.round((utc - anchor) / 86400000);
        return ((days % 60) + 60) % 60;
    }

    function getHourBranch(hour) {
        return Math.floor(((hour + 1) % 24) / 2);
    }

    function hourCycleIndex(dayIndex, hourBranch) {
        const dayStem = dayIndex % 10;
        // 五鼠遁：甲己还加甲
        const ziStemByDayStem = [0, 2, 4, 6, 8, 0, 2, 4, 6, 8];
        const ziStem = ziStemByDayStem[dayStem];
        const stem = (ziStem + hourBranch) % 10;
        for (let i = 0; i < 60; i++) {
            if (i % 10 === stem && i % 12 === hourBranch) return i;
        }
        return 0;
    }

    function fromDate(date) {
        const dt = date instanceof Date ? date : new Date(date);
        const yearNo = getYearNumber(dt);
        const yearIndex = getYearIndex(yearNo);
        const monthBranch = getMonthBranch(dt);
        const monthIndex = monthCycleIndex(yearIndex, monthBranch);
        const dayIndex = getDayIndex(dt);
        const hourBranch = getHourBranch(dt.getHours());
        const hourIndex = hourCycleIndex(dayIndex, hourBranch);

        const year = pillarFromIndex(yearIndex);
        const month = pillarFromIndex(monthIndex);
        const day = pillarFromIndex(dayIndex);
        const hour = pillarFromIndex(hourIndex);

        return {
            year,
            month,
            day,
            hour,
            hourBranch: BRANCHES[hourBranch],
            text: `${year}年 ${month}月 ${day}日 ${hour}时`
        };
    }

    function describeFromBinary(record, binaryStr) {
        const base = record || { name: '未知卦象', nature: '', symbol: '' };
        const lower = TRIGRAMS[binaryStr.slice(0, 3)] || null;
        const upper = TRIGRAMS[binaryStr.slice(3, 6)] || null;
        const trigramText = (upper && lower)
            ? (upper.name === lower.name
                ? `${upper.name}为${upper.nature}`
                : `${upper.nature}${lower.nature} · ${upper.name}上${lower.name}下`)
            : (base.symbol || '');

        return {
            name: base.name,
            nature: base.nature,
            symbol: (upper && lower) ? `${upper.symbol}${lower.symbol}` : (base.symbol || ''),
            binary: binaryStr,
            upper,
            lower,
            trigramText
        };
    }

    root.GanzhiModule = {
        TRIGRAMS,
        fromDate,
        describeFromBinary,
        pillarFromIndex
    };
}(typeof window !== 'undefined' ? window : globalThis));
