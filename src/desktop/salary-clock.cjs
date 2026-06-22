const STATUS_LABELS = {
  working: '工作中',
  lunch: '午休中',
  off: '不要工作了',
  holiday: '不要工作了'
};

function computeClockState(settings, now = new Date(), calendarOverrides = {}) {
  const dateKey = formatDateKey(now);
  const workStart = atTime(now, settings.workStart);
  const workEnd = atTime(now, settings.workEnd);
  const lunchStart = atTime(now, settings.lunchStart);
  const lunchEnd = atTime(now, settings.lunchEnd);
  const dailyWorkSeconds = Math.max(1, secondsBetween(workStart, workEnd) - secondsBetween(lunchStart, lunchEnd));
  const currentSalary = getSalaryForDate(settings.salaryHistory, dateKey);
  const secondRate = currentSalary / settings.monthlyWorkDays / dailyWorkSeconds;
  const dayType = getDayType(settings, now, calendarOverrides);
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
  const totalEarnedRmb = computeTotalEarned(settings, now, earnedTodayRmb, calendarOverrides);
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

function getDayType(settings, date, calendarOverrides = {}) {
  const dateKey = formatDateKey(date);
  const manualWorkdays = new Set(settings.workdayDates || []);
  const manualHolidays = new Set(settings.holidayDates || []);
  const calendarWorkdays = new Set(calendarOverrides.workdayDates || []);
  const calendarHolidays = new Set(calendarOverrides.holidayDates || []);

  if (manualWorkdays.has(dateKey)) {
    return 'workday';
  }

  if (manualHolidays.has(dateKey)) {
    return 'holiday';
  }

  if (calendarWorkdays.has(dateKey)) {
    return 'workday';
  }

  if (calendarHolidays.has(dateKey)) {
    return 'holiday';
  }

  const day = date.getDay();
  return day === 0 || day === 6 ? 'holiday' : 'workday';
}

function computeTotalEarned(settings, now, todayEarned, calendarOverrides = {}) {
  const hireDate = parseDate(settings.hireDate);
  const today = startOfDay(now);
  if (hireDate > today) {
    return 0;
  }

  let total = 0;
  for (let day = new Date(hireDate); day < today; day.setDate(day.getDate() + 1)) {
    if (getDayType(settings, day, calendarOverrides) === 'workday') {
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
  STATUS_LABELS,
  computeClockState,
  formatDateKey,
  getDayType,
  getEffectiveWorkedSeconds,
  getSalaryForDate
};
