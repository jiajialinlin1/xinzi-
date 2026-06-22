const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_SETTINGS = {
  workStart: '09:00',
  workEnd: '18:00',
  lunchStart: '12:00',
  lunchEnd: '13:30',
  monthlyWorkDays: 21.75,
  hireDate: new Date().toISOString().slice(0, 10),
  salaryHistory: [
    {
      effectiveFrom: new Date().toISOString().slice(0, 10),
      monthlySalaryRmb: 10000
    }
  ],
  holidayDates: [],
  workdayDates: [],
  fishReviewRules: [
    { minMinutes: 0, maxMinutes: 5, comment: '热身都算不上。' },
    { minMinutes: 6, maxMinutes: 15, comment: '合理摸鱼，精神保养。' },
    { minMinutes: 16, maxMinutes: 30, comment: '已经开始有点东西了。' },
    { minMinutes: 31, maxMinutes: null, comment: '这才是成熟打工人的节奏。' }
  ]
};

function createSettingsStore(app) {
  const filePath = path.join(app.getPath('userData'), 'settings.json');

  function load() {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      return normalizeSettings(JSON.parse(raw));
    } catch {
      const settings = normalizeSettings(DEFAULT_SETTINGS);
      save(settings);
      return settings;
    }
  }

  function save(settings) {
    const cleanSettings = normalizeSettings(settings);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(cleanSettings, null, 2)}\n`, 'utf8');
    return cleanSettings;
  }

  return {
    filePath,
    load,
    save
  };
}

function normalizeSettings(input = {}) {
  const base = {
    ...DEFAULT_SETTINGS,
    ...input
  };

  return {
    workStart: normalizeTime(base.workStart, DEFAULT_SETTINGS.workStart),
    workEnd: normalizeTime(base.workEnd, DEFAULT_SETTINGS.workEnd),
    lunchStart: normalizeTime(base.lunchStart, DEFAULT_SETTINGS.lunchStart),
    lunchEnd: normalizeTime(base.lunchEnd, DEFAULT_SETTINGS.lunchEnd),
    monthlyWorkDays: positiveNumber(base.monthlyWorkDays, DEFAULT_SETTINGS.monthlyWorkDays),
    hireDate: normalizeDate(base.hireDate, DEFAULT_SETTINGS.hireDate),
    salaryHistory: normalizeSalaryHistory(base.salaryHistory, base.hireDate),
    holidayDates: normalizeDateList(base.holidayDates),
    workdayDates: normalizeDateList(base.workdayDates),
    fishReviewRules: normalizeFishReviewRules(base.fishReviewRules)
  };
}

function normalizeSalaryHistory(history, hireDate) {
  const fallbackDate = normalizeDate(hireDate, DEFAULT_SETTINGS.hireDate);
  const clean = Array.isArray(history)
    ? history
      .map((item) => ({
        effectiveFrom: normalizeDate(item?.effectiveFrom, fallbackDate),
        monthlySalaryRmb: positiveNumber(item?.monthlySalaryRmb, 0)
      }))
      .filter((item) => item.monthlySalaryRmb > 0)
    : [];

  if (clean.length === 0) {
    clean.push({
      effectiveFrom: fallbackDate,
      monthlySalaryRmb: DEFAULT_SETTINGS.salaryHistory[0].monthlySalaryRmb
    });
  }

  return clean.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
}

function normalizeDateList(list) {
  if (!Array.isArray(list)) {
    return [];
  }

  return [...new Set(list.map((item) => normalizeDate(item, '')).filter(Boolean))].sort();
}

function normalizeFishReviewRules(rules) {
  const clean = Array.isArray(rules)
    ? rules
      .map((rule) => {
        const minMinutes = nonNegativeInteger(rule?.minMinutes, null);
        const maxMinutes = rule?.maxMinutes === null || rule?.maxMinutes === ''
          ? null
          : nonNegativeInteger(rule?.maxMinutes, null);
        const comment = typeof rule?.comment === 'string' ? rule.comment.trim() : '';

        return { minMinutes, maxMinutes, comment };
      })
      .filter((rule) => (
        rule.minMinutes !== null
        && (rule.maxMinutes === null || rule.maxMinutes >= rule.minMinutes)
        && rule.comment
      ))
    : [];

  return clean.length > 0 ? clean : DEFAULT_SETTINGS.fishReviewRules;
}

function normalizeTime(value, fallback) {
  return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value) ? value : fallback;
}

function normalizeDate(value, fallback) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function nonNegativeInteger(value, fallback) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

module.exports = {
  DEFAULT_SETTINGS,
  createSettingsStore,
  normalizeSettings
};
