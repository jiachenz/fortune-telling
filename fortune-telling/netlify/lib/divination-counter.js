/**
 * 求卦计数：今日第 X 位（按 deviceId 去重）+ 该设备今日第 Y 次
 *
 * 日记录结构（存在 Blobs / 本地 JSON）：
 * {
 *   count: number,   // 今日求卦总次数（看板仍用这个）
 *   unique: number,  // 今日独立设备数
 *   devices: { [deviceId]: { rank, times } }
 * }
 *
 * 兼容旧数据：只有 { count: N } 时，从 unique=0 开始给新设备编号。
 */

function normalizeDay(raw) {
    if (typeof raw === 'number') {
        return { count: raw, unique: 0, devices: {} };
    }
    if (!raw || typeof raw !== 'object') {
        return { count: 0, unique: 0, devices: {} };
    }
    return {
        count: raw.count || 0,
        unique: raw.unique || 0,
        devices: raw.devices && typeof raw.devices === 'object' ? raw.devices : {}
    };
}

/**
 * @returns {{ day: object, rank: number|null, times: number|null }}
 */
function recordDivination(raw, deviceId) {
    const day = normalizeDay(raw);
    day.count += 1;

    if (!deviceId || typeof deviceId !== 'string') {
        return { day, rank: day.unique || null, times: 1 };
    }

    const existing = day.devices[deviceId];
    if (existing && existing.rank) {
        existing.times = (existing.times || 0) + 1;
        day.devices[deviceId] = existing;
        return { day, rank: existing.rank, times: existing.times };
    }

    day.unique += 1;
    const rank = day.unique;
    day.devices[deviceId] = { rank, times: 1 };
    return { day, rank, times: 1 };
}

function dayCount(raw) {
    if (typeof raw === 'number') return raw;
    if (raw && typeof raw.count === 'number') return raw.count;
    return 0;
}

module.exports = { normalizeDay, recordDivination, dayCount };
