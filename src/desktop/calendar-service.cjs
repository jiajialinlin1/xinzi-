const fs = require('node:fs');
const path = require('node:path');

const PUBLIC_HOLIDAY_ENDPOINT = 'http://publicHoliday.zysoft.vip:5000/getDayInfo';
function createCalendarService(app, { now = () => new Date(), fetchImpl = globalThis.fetch } = {}) {
  const filePath = path.join(app.getPath('userData'), 'public-holiday-cache.json');
  let cache = loadCache(filePath);
  let status = buildStatus('not-loaded', '尚未同步节假日数据', now(), cache, null);

  async function refresh(referenceDate = now()) {
    const dateKey = formatDateKey(referenceDate);
    try {
      const dayInfo = await fetchPublicHoliday(dateKey, fetchImpl);
      cache.days[dateKey] = {
        ...dayInfo,
        updatedAt: now().toISOString()
      };
      saveCache(filePath, cache);
      status = buildStatus('online', '已同步 publicHoliday 节假日数据', referenceDate, cache, cache.days[dateKey]);
    } catch (error) {
      const cachedDay = cache.days[dateKey] || null;
      status = buildStatus(
        cachedDay ? 'cached' : 'fallback',
        cachedDay ? '接口失败，正在使用本地缓存' : '接口失败，正在使用周末规则',
        referenceDate,
        cache,
        cachedDay,
        error.message
      );
    }
    return getStatus();
  }

  function getStatus() {
    return cloneStatus(status);
  }

  async function requestAccess(referenceDate = now()) {
    return refresh(referenceDate);
  }

  return {
    filePath,
    getStatus,
    refresh,
    requestAccess
  };
}

async function fetchPublicHoliday(dateKey, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('当前运行环境不支持 fetch');
  }

  const dateParam = dateKey.replace(/-/g, '');
  const url = `${PUBLIC_HOLIDAY_ENDPOINT}?date=${dateParam}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  const response = await fetchImpl(url, {
    method: 'GET',
    signal: controller.signal
  }).finally(() => clearTimeout(timer));
  if (!response.ok) {
    throw new Error(`节假日接口请求失败：${response.status}`);
  }

  const payload = await response.json();
  return normalizePublicHolidayPayload(payload);
}

function normalizePublicHolidayPayload(payload) {
  const rawDate = String(payload?.date || '');
  const dateKey = rawDate.length === 8
    ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
    : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error('节假日接口返回了非法日期');
  }

  const weekType = Number(payload.weekType);
  const isWorkday = Boolean(payload.isWorkday);
  return {
    date: dateKey,
    isWorkday,
    weekType,
    workdayTypeStr: typeof payload.workdayTypeStr === 'string' ? payload.workdayTypeStr : '',
    description: typeof payload.description === 'string' ? payload.description : '',
    weekday: Number(payload.weekday) || null,
    weekdayStr: typeof payload.weekdayStr === 'string' ? payload.weekdayStr : ''
  };
}

function buildStatus(source, message, referenceDate, cache, dayInfo, errorMessage = '') {
  const todayType = getProviderDayType(dayInfo);
  return {
    available: source === 'online' || source === 'cached',
    permissionStatus: source === 'online' || source === 'cached' ? 'granted' : source,
    source,
    providerName: 'publicHoliday',
    message,
    errorMessage,
    matchedCalendars: source === 'online' ? ['publicHoliday API'] : source === 'cached' ? ['本地缓存'] : [],
    todayType,
    todayInfo: dayInfo,
    holidayDates: todayType === 'holiday' ? [formatDateKey(referenceDate)] : [],
    workdayDates: todayType === 'workday' ? [formatDateKey(referenceDate)] : [],
    cacheUpdatedAt: dayInfo?.updatedAt || getLatestCacheUpdatedAt(cache),
    updatedAt: new Date().toISOString()
  };
}

function getProviderDayType(dayInfo) {
  if (!dayInfo) {
    return 'unknown';
  }
  return dayInfo.isWorkday ? 'workday' : 'holiday';
}

function loadCache(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return normalizeCache(JSON.parse(raw));
  } catch {
    return normalizeCache({});
  }
}

function saveCache(filePath, cache) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
}

function normalizeCache(input) {
  const days = {};
  for (const [dateKey, day] of Object.entries(input?.days || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      continue;
    }
    days[dateKey] = {
      date: dateKey,
      isWorkday: Boolean(day?.isWorkday),
      weekType: Number(day?.weekType) || 0,
      workdayTypeStr: typeof day?.workdayTypeStr === 'string' ? day.workdayTypeStr : '',
      description: typeof day?.description === 'string' ? day.description : '',
      weekday: Number(day?.weekday) || null,
      weekdayStr: typeof day?.weekdayStr === 'string' ? day.weekdayStr : '',
      updatedAt: typeof day?.updatedAt === 'string' ? day.updatedAt : ''
    };
  }
  return { days };
}

function getLatestCacheUpdatedAt(cache) {
  return Object.values(cache.days || {})
    .map((day) => day.updatedAt)
    .filter(Boolean)
    .sort()
    .at(-1) || '';
}

function cloneStatus(status) {
  return {
    ...status,
    matchedCalendars: [...status.matchedCalendars],
    holidayDates: [...status.holidayDates],
    workdayDates: [...status.workdayDates],
    todayInfo: status.todayInfo ? { ...status.todayInfo } : null
  };
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = {
  createCalendarService,
  fetchPublicHoliday,
  normalizePublicHolidayPayload
};
