const BUILT_IN_HOLIDAYS = {
  holidayDates: [
    '2025-01-01',
    '2025-01-28',
    '2025-01-29',
    '2025-01-30',
    '2025-01-31',
    '2025-02-01',
    '2025-02-02',
    '2025-02-03',
    '2025-02-04',
    '2025-04-04',
    '2025-04-05',
    '2025-04-06',
    '2025-05-01',
    '2025-05-02',
    '2025-05-03',
    '2025-05-04',
    '2025-05-05',
    '2025-05-31',
    '2025-06-01',
    '2025-06-02',
    '2025-10-01',
    '2025-10-02',
    '2025-10-03',
    '2025-10-04',
    '2025-10-05',
    '2025-10-06',
    '2025-10-07',
    '2025-10-08',
    '2026-01-01',
    '2026-01-02',
    '2026-01-03',
    '2026-02-16',
    '2026-02-17',
    '2026-02-18',
    '2026-02-19',
    '2026-02-20',
    '2026-02-21',
    '2026-02-22',
    '2026-02-23',
    '2026-04-04',
    '2026-04-05',
    '2026-04-06',
    '2026-05-01',
    '2026-05-02',
    '2026-05-03',
    '2026-05-04',
    '2026-05-05',
    '2026-06-19',
    '2026-06-20',
    '2026-06-21',
    '2026-09-25',
    '2026-09-26',
    '2026-09-27',
    '2026-10-01',
    '2026-10-02',
    '2026-10-03',
    '2026-10-04',
    '2026-10-05',
    '2026-10-06',
    '2026-10-07'
  ],
  workdayDates: [
    '2025-01-26',
    '2025-02-08',
    '2025-04-27',
    '2025-09-28',
    '2025-10-11',
    '2026-02-14',
    '2026-02-28',
    '2026-09-20',
    '2026-10-10'
  ]
};

const STATUS_LABELS = {
  working: '工作中',
  lunch: '午休中',
  off: '不要工作了',
  holiday: '不要工作了'
};

function computeClockState(settings, now = new Date()) {
  const dateKey = formatDateKey(now);
  const workStart = atTime(now, settings.workStart);
  const workEnd = atTime(now, settings.workEnd);
  const lunchStart = atTime(now, settings.lunchStart);
  const lunchEnd = atTime(now, settings.lunchEnd);
  const dailyWorkSeconds = Math.max(1, secondsBetween(workStart, workEnd) - secondsBetween(lunchStart, lunchEnd));
  const currentSalary = getSalaryForDate(settings.salaryHistory, dateKey);
  const secondRate = currentSalary / settings.monthlyWorkDays / dailyWorkSeconds;
  const dayType = getDayType(settings, now);
  const isWorkday = dayType === 'workday';
  const inLunch = isWorkday && now >= lunchStart && now < lunchEnd;
  const inWork = isWorkday && now >= workStart && now < workEnd && !inLunch;
  const status = isWorkday ? getWorkStatus(now, workStart, workEnd, lunchStart, lunchEnd) : 'holiday';
  const effectiveWorkedSecondsToday = isWorkday
    ? getEffectiveWorkedSeconds(now, workStart, workEnd, lunchStart, lunchEnd)
    : 0;
  const elapsedSecondsToday = isWorkday && now > workStart
    ? Math.max(0, secondsBetween(workStart, minDate(now, workEnd)))
    : 0;
  const remainingSecondsToOff = isWorkday && now < workEnd
    ? Math.max(0, secondsBetween(now, workEnd))
    : 0;
  const earnedTodayRmb = effectiveWorkedSecondsToday * secondRate;
  const totalEarnedRmb = computeTotalEarned(settings, now, earnedTodayRmb);
  const employmentDays = Math.max(0, daysBetween(parseDate(settings.hireDate), startOfDay(now)) + 1);
  const trayText = status === 'working'
    ? formatRmbShort(earnedTodayRmb)
    : STATUS_LABELS[status];

  return {
    status,
    statusText: STATUS_LABELS[status],
    dayType,
    date: dateKey,
    trayText,
    workedSecondsToday: elapsedSecondsToday,
    effectiveWorkedSecondsToday,
    remainingSecondsToOff,
    earnedTodayRmb,
    totalEarnedRmb,
    employmentDays,
    monthlySalaryRmb: currentSalary,
    dailyWorkSeconds,
    secondRateRmb: secondRate,
    isWorkday,
    inLunch,
    inWork,
    updatedAt: now.toISOString()
  };
}

function getWorkStatus(now, workStart, workEnd, lunchStart, lunchEnd) {
  if (now >= lunchStart && now < lunchEnd) {
    return 'lunch';
  }

  if (now >= workStart && now < workEnd) {
    return 'working';
  }

  return 'off';
}

function getEffectiveWorkedSeconds(now, workStart, workEnd, lunchStart, lunchEnd) {
  const cappedNow = minDate(maxDate(now, workStart), workEnd);
  let seconds = secondsBetween(workStart, cappedNow);

  if (cappedNow > lunchStart) {
    seconds -= secondsBetween(lunchStart, minDate(cappedNow, lunchEnd));
  }

  return Math.max(0, seconds);
}

function getDayType(settings, date) {
  const dateKey = formatDateKey(date);
  const manualWorkdays = new Set(settings.workdayDates || []);
  const manualHolidays = new Set(settings.holidayDates || []);
  const builtInWorkdays = new Set(BUILT_IN_HOLIDAYS.workdayDates);
  const builtInHolidays = new Set(BUILT_IN_HOLIDAYS.holidayDates);

  if (manualWorkdays.has(dateKey)) {
    return 'workday';
  }

  if (manualHolidays.has(dateKey)) {
    return 'holiday';
  }

  if (builtInWorkdays.has(dateKey)) {
    return 'workday';
  }

  if (builtInHolidays.has(dateKey)) {
    return 'holiday';
  }

  const day = date.getDay();
  return day === 0 || day === 6 ? 'holiday' : 'workday';
}

function computeTotalEarned(settings, now, todayEarned) {
  const hireDate = parseDate(settings.hireDate);
  const today = startOfDay(now);
  if (hireDate > today) {
    return 0;
  }

  let total = 0;
  for (let day = new Date(hireDate); day < today; day.setDate(day.getDate() + 1)) {
    if (getDayType(settings, day) === 'workday') {
      total += getSalaryForDate(settings.salaryHistory, formatDateKey(day)) / settings.monthlyWorkDays;
    }
  }

  return total + todayEarned;
}

function getSalaryForDate(history, dateKey) {
  const sorted = [...history].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  let salary = sorted[0]?.monthlySalaryRmb || 0;
  for (const item of sorted) {
    if (item.effectiveFrom <= dateKey) {
      salary = item.monthlySalaryRmb;
    }
  }

  return salary;
}

function atTime(baseDate, time) {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date(baseDate);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function secondsBetween(start, end) {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
}

function daysBetween(start, end) {
  return Math.floor((startOfDay(end).getTime() - startOfDay(start).getTime()) / 86400000);
}

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function parseDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatRmbShort(value) {
  return `¥${Number(value || 0).toFixed(2)}`;
}

function minDate(a, b) {
  return a < b ? a : b;
}

function maxDate(a, b) {
  return a > b ? a : b;
}

module.exports = {
  BUILT_IN_HOLIDAYS,
  STATUS_LABELS,
  computeClockState,
  formatDateKey,
  getDayType,
  getEffectiveWorkedSeconds,
  getSalaryForDate
};
