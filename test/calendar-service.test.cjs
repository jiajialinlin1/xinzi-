const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  createCalendarService,
  normalizePublicHolidayPayload
} = require('../src/desktop/calendar-service.cjs');

function tempApp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xinzi-calendar-'));
  return {
    dir,
    getPath: () => dir
  };
}

function okFetch(payload) {
  return async () => ({
    ok: true,
    json: async () => payload
  });
}

test('normalizes publicHoliday payload into app date format', () => {
  const day = normalizePublicHolidayPayload({
    date: '20250126',
    isWorkday: true,
    weekType: 1,
    workdayTypeStr: '工作日',
    description: '为春节放假调休补班',
    weekday: 7,
    weekdayStr: '星期日',
    ad: 'ignored'
  });

  assert.deepEqual(day, {
    date: '2025-01-26',
    isWorkday: true,
    weekType: 1,
    workdayTypeStr: '工作日',
    description: '为春节放假调休补班',
    weekday: 7,
    weekdayStr: '星期日'
  });
});

test('refresh uses online publicHoliday response', async () => {
  const app = tempApp();
  const service = createCalendarService(app, {
    now: () => new Date('2025-01-26T10:00:00+08:00'),
    fetchImpl: okFetch({
      date: '20250126',
      isWorkday: true,
      weekType: 1,
      workdayTypeStr: '工作日'
    })
  });

  const status = await service.refresh();
  assert.equal(status.source, 'online');
  assert.equal(status.todayType, 'workday');
  assert.deepEqual(status.workdayDates, ['2025-01-26']);
  assert.deepEqual(status.holidayDates, []);
});

test('refresh falls back to cached data when API fails', async () => {
  const app = tempApp();
  const service = createCalendarService(app, {
    now: () => new Date('2025-10-01T10:00:00+08:00'),
    fetchImpl: okFetch({
      date: '20251001',
      isWorkday: false,
      weekType: 2,
      workdayTypeStr: '法定节假日'
    })
  });
  await service.refresh();

  const cachedService = createCalendarService(app, {
    now: () => new Date('2025-10-01T10:00:00+08:00'),
    fetchImpl: async () => {
      throw new Error('network down');
    }
  });
  const status = await cachedService.refresh();
  assert.equal(status.source, 'cached');
  assert.equal(status.todayType, 'holiday');
  assert.deepEqual(status.holidayDates, ['2025-10-01']);
});

test('refresh uses weekend fallback without cache', async () => {
  const app = tempApp();
  const service = createCalendarService(app, {
    now: () => new Date('2025-06-16T10:00:00+08:00'),
    fetchImpl: async () => {
      throw new Error('network down');
    }
  });

  const status = await service.refresh();
  assert.equal(status.source, 'fallback');
  assert.equal(status.todayType, 'unknown');
  assert.deepEqual(status.holidayDates, []);
  assert.deepEqual(status.workdayDates, []);
});
