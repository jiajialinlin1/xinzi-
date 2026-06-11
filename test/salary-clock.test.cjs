const assert = require('node:assert/strict');
const test = require('node:test');
const {
  computeClockState,
  getDayType,
  getSalaryForDate
} = require('../src/desktop/salary-clock.cjs');

const baseSettings = {
  workStart: '09:00',
  workEnd: '18:00',
  lunchStart: '12:00',
  lunchEnd: '13:30',
  monthlyWorkDays: 21.75,
  hireDate: '2026-06-01',
  salaryHistory: [
    { effectiveFrom: '2026-06-01', monthlySalaryRmb: 21750 }
  ],
  holidayDates: [],
  workdayDates: []
};

test('computes live working salary during a workday', () => {
  const state = computeClockState(baseSettings, new Date('2026-06-11T10:00:00+08:00'));

  assert.equal(state.status, 'working');
  assert.equal(state.trayText, '¥133.33');
  assert.equal(state.workedSecondsToday, 3600);
  assert.equal(state.effectiveWorkedSecondsToday, 3600);
  assert.equal(state.remainingSecondsToOff, 28800);
});

test('freezes earned salary during lunch while elapsed work time continues', () => {
  const state = computeClockState(baseSettings, new Date('2026-06-11T12:30:00+08:00'));

  assert.equal(state.status, 'lunch');
  assert.equal(state.trayText, '午休中');
  assert.equal(state.workedSecondsToday, 12600);
  assert.equal(state.effectiveWorkedSecondsToday, 10800);
  assert.equal(Number(state.earnedTodayRmb.toFixed(2)), 400);
});

test('manual holiday disables salary calculation on a normal workday', () => {
  const settings = {
    ...baseSettings,
    holidayDates: ['2026-06-11']
  };
  const state = computeClockState(settings, new Date('2026-06-11T10:00:00+08:00'));

  assert.equal(getDayType(settings, new Date('2026-06-11T10:00:00+08:00')), 'holiday');
  assert.equal(state.status, 'holiday');
  assert.equal(state.trayText, '不要工作了');
  assert.equal(state.earnedTodayRmb, 0);
});

test('manual workday overrides weekend and enables salary calculation', () => {
  const settings = {
    ...baseSettings,
    workdayDates: ['2026-06-13']
  };
  const state = computeClockState(settings, new Date('2026-06-13T10:00:00+08:00'));

  assert.equal(getDayType(settings, new Date('2026-06-13T10:00:00+08:00')), 'workday');
  assert.equal(state.status, 'working');
  assert.equal(state.trayText, '¥133.33');
});

test('uses salary history by effective date', () => {
  const history = [
    { effectiveFrom: '2026-01-01', monthlySalaryRmb: 10000 },
    { effectiveFrom: '2026-06-01', monthlySalaryRmb: 20000 }
  ];

  assert.equal(getSalaryForDate(history, '2026-05-31'), 10000);
  assert.equal(getSalaryForDate(history, '2026-06-01'), 20000);
});
