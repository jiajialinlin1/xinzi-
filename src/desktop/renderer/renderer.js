const view = new URLSearchParams(window.location.search).get('view') || 'popover';
document.body.dataset.view = view;
document.body.dataset.mode = view === 'main' ? 'overview' : 'popover';

const EYE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18"/><path d="M10.6 10.6A3 3 0 0 0 13.4 13.4"/><path d="M7.5 7.5C4 9.1 2 12 2 12s3.5 6 10 6c1.6 0 3-.35 4.2-.9"/><path d="M14.1 6.3C20 7.4 22 12 22 12s-.8 1.4-2.4 2.9"/></svg>';

const elements = {
  pageTitle: document.querySelector('#pageTitle'),
  statusPill: document.querySelector('#statusPill'),
  earnedToday: document.querySelector('#earnedToday'),
  fishSummary: document.querySelector('#fishSummary'),
  workedTime: document.querySelector('#workedTime'),
  remainingTime: document.querySelector('#remainingTime'),
  monthlySalary: document.querySelector('#monthlySalary'),
  secondRate: document.querySelector('#secondRate'),
  employmentDays: document.querySelector('#employmentDays'),
  totalEarned: document.querySelector('#totalEarned'),
  openMainButton: document.querySelector('#openMainButton'),
  showPopoverButton: document.querySelector('#showPopoverButton'),
  openSettingsButton: document.querySelector('#openSettingsButton'),
  saveSettingsButton: document.querySelector('#saveSettingsButton'),
  addSalaryButton: document.querySelector('#addSalaryButton'),
  requestCalendarButton: document.querySelector('#requestCalendarButton'),
  calendarPermissionStatus: document.querySelector('#calendarPermissionStatus'),
  calendarNames: document.querySelector('#calendarNames'),
  calendarTodayType: document.querySelector('#calendarTodayType'),
  calendarMessage: document.querySelector('#calendarMessage'),
  fishIdleControls: document.querySelector('#fishIdleControls'),
  fishActiveButton: document.querySelector('#fishActiveButton'),
  fishUnavailableText: document.querySelector('#fishUnavailableText'),
  startFishingButton: document.querySelector('#startFishingButton'),
  startFishingCountdownButton: document.querySelector('#startFishingCountdownButton'),
  fishMinutesInput: document.querySelector('#fishMinutesInput'),
  fishOverlay: document.querySelector('#fishOverlay'),
  fishCountdownView: document.querySelector('#fishCountdownView'),
  fishConfirmView: document.querySelector('#fishConfirmView'),
  fishCountdownNumber: document.querySelector('#fishCountdownNumber'),
  fishKeepWorkingButton: document.querySelector('#fishKeepWorkingButton'),
  fishMoreButton: document.querySelector('#fishMoreButton'),
  fishToast: document.querySelector('#fishToast'),
  fishToastText: document.querySelector('#fishToastText'),
  metricEyeButtons: [...document.querySelectorAll('.metric-eye-button')],
  fishDetailsList: document.querySelector('#fishDetailsList'),
  fishDetailsEmpty: document.querySelector('#fishDetailsEmpty'),
  addFishReviewRuleButton: document.querySelector('#addFishReviewRuleButton'),
  fishReviewRulesList: document.querySelector('#fishReviewRulesList'),
  salaryHistoryList: document.querySelector('#salaryHistoryList'),
  workStart: document.querySelector('#workStart'),
  workEnd: document.querySelector('#workEnd'),
  lunchStart: document.querySelector('#lunchStart'),
  lunchEnd: document.querySelector('#lunchEnd'),
  monthlyWorkDays: document.querySelector('#monthlyWorkDays'),
  hireDate: document.querySelector('#hireDate'),
  holidayDates: document.querySelector('#holidayDates'),
  workdayDates: document.querySelector('#workdayDates')
};

let currentSettings = null;
let latestState = null;
let latestFish = null;
let latestUiState = null;
let formDirty = false;
let hideTimer = null;
let fishMinutesEditing = false;

elements.openMainButton?.addEventListener('click', () => window.xinziAPI.openMainWindow());
elements.showPopoverButton?.addEventListener('click', () => window.xinziAPI.showPopover());
elements.openSettingsButton?.addEventListener('click', () => enterSettingsMode());
elements.saveSettingsButton?.addEventListener('click', () => saveSettings());
elements.requestCalendarButton?.addEventListener('click', () => requestCalendarAccess());
elements.startFishingButton?.addEventListener('click', () => startFishing());
elements.startFishingCountdownButton?.addEventListener('click', () => startFishingCountdown());
elements.fishActiveButton?.addEventListener('click', () => confirmFishingStop());
elements.fishKeepWorkingButton?.addEventListener('click', () => stopAndSaveFishing());
elements.fishMoreButton?.addEventListener('click', () => resumeFishing());
elements.fishToast?.addEventListener('click', () => hideFishToast());
elements.fishMinutesInput?.addEventListener('focus', () => {
  fishMinutesEditing = true;
});
elements.fishMinutesInput?.addEventListener('blur', () => {
  fishMinutesEditing = false;
});
elements.fishMinutesInput?.addEventListener('change', () => updateFishingMinutes());
elements.metricEyeButtons.forEach((button) => {
  button.addEventListener('click', () => toggleHiddenMetric(button.dataset.metricKey));
});
elements.addFishReviewRuleButton?.addEventListener('click', () => {
  addFishReviewRuleRow({ minMinutes: 0, maxMinutes: null, comment: '无话可说，继续观察。' });
  markDirty();
});
elements.addSalaryButton?.addEventListener('click', () => {
  addSalaryRow({
    effectiveFrom: elements.hireDate.value || new Date().toISOString().slice(0, 10),
    monthlySalaryRmb: 10000
  });
  markDirty();
});

for (const input of document.querySelectorAll('input, textarea')) {
  input.addEventListener('input', markDirty);
}

if (view === 'popover') {
  document.body.addEventListener('mouseenter', () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  });
  document.body.addEventListener('mouseleave', () => {
    hideTimer = setTimeout(() => window.xinziAPI.hidePopover(), 50);
  });
}

window.xinziAPI.onStateChange(renderPayload);
Promise.all([
  window.xinziAPI.getSettings(),
  window.xinziAPI.getClockState(),
  window.xinziAPI.getCalendarStatus(),
  window.xinziAPI.getFishState(),
  window.xinziAPI.getUiState()
]).then(([settings, state, calendar, fish, ui]) => renderPayload({ settings, state, calendar, fish, ui }));

function renderPayload(payload) {
  currentSettings = payload.settings;
  latestState = payload.state || latestState;
  latestFish = payload.fish || latestFish;
  latestUiState = payload.ui || latestUiState;
  renderState(payload.state);
  renderCalendarStatus(payload.calendar);
  renderFishState(payload.fish);
  renderMetricVisibilityButtons();
  if (view === 'main' && document.body.dataset.mode === 'settings' && !formDirty) {
    populateSettings(payload.settings);
  }
}

function enterSettingsMode() {
  if (view !== 'main') {
    return;
  }

  document.body.dataset.mode = 'settings';
  elements.pageTitle.textContent = '设置';
  if (currentSettings) {
    populateSettings(currentSettings);
  }
}

function exitSettingsMode() {
  if (view !== 'main') {
    return;
  }

  document.body.dataset.mode = 'overview';
  elements.pageTitle.textContent = '薪资计时器';
}

async function requestCalendarAccess() {
  if (!window.xinziAPI.requestCalendarAccess || !elements.calendarMessage) {
    return;
  }

  elements.calendarMessage.textContent = '正在同步 publicHoliday 节假日数据...';
  const calendar = await window.xinziAPI.requestCalendarAccess();
  renderCalendarStatus(calendar);
}

function renderState(state) {
  if (!state) {
    return;
  }

  const isOff = state.status === 'off' || state.status === 'holiday';
  elements.statusPill.textContent = state.statusText;
  elements.statusPill.className = `status-pill ${state.status}`;
  elements.earnedToday.textContent = isOff ? '不要工作了' : formatRmb(state.earnedTodayRmb);
  elements.workedTime.textContent = isOff ? '不要工作了' : formatDuration(state.workedSecondsToday);
  elements.remainingTime.textContent = isOff ? '不要工作了' : formatDuration(state.remainingSecondsToOff);
  renderMetricValue(elements.monthlySalary, 'totalEarned', formatRmb(state.totalEarnedRmb), '¥••••••');
  renderMetricValue(elements.secondRate, 'secondRate', `¥${Number(state.secondRateRmb || 0).toFixed(4)}`, '¥••••');
  renderMetricValue(elements.employmentDays, 'employmentDays', `${state.employmentDays} 天`, '•• 天');
  renderMetricValue(elements.totalEarned, 'companyTotal', formatRmb(state.totalEarnedRmb), '¥••••••');
}

function renderMetricValue(element, key, value, maskedValue) {
  if (!element) {
    return;
  }

  element.textContent = isMetricHidden(key) ? maskedValue : value;
}

function isMetricHidden(key) {
  return Boolean(latestUiState?.hiddenMetrics?.[key]);
}

async function toggleHiddenMetric(key) {
  if (!key || !window.xinziAPI.toggleHiddenMetric) {
    return;
  }

  latestUiState = await window.xinziAPI.toggleHiddenMetric(key);
  renderState(latestState);
  renderMetricVisibilityButtons();
}

function renderMetricVisibilityButtons() {
  for (const button of elements.metricEyeButtons) {
    const hidden = isMetricHidden(button.dataset.metricKey);
    button.innerHTML = hidden ? EYE_OFF_ICON : EYE_ICON;
    button.classList.toggle('is-hidden', hidden);
    button.setAttribute('aria-pressed', String(hidden));
  }
}

function renderCalendarStatus(calendar) {
  if (!elements.calendarPermissionStatus || !calendar) {
    return;
  }

  elements.calendarPermissionStatus.textContent = formatPermissionStatus(calendar.source || calendar.permissionStatus);
  if (elements.calendarNames) {
    elements.calendarNames.textContent = formatCalendarSource(calendar);
  }
  elements.calendarTodayType.textContent = formatCalendarTodayType(calendar);
  if (elements.calendarMessage) {
    elements.calendarMessage.textContent = calendar.message || '未同步节假日数据';
  }
  elements.requestCalendarButton.disabled = false;
}

function renderFishState(fish) {
  if (!elements.fishIdleControls || !fish) {
    return;
  }

  latestFish = fish;
  document.body.dataset.fishMode = fish.status;
  syncFishMinutesInput(fish.defaultMinutes);
  elements.fishCountdownNumber.textContent = String(Math.max(1, fish.countdownRemainingSeconds || 1));
  elements.fishActiveButton.textContent = `摸鱼${formatShortFishMinutes(fish.sessionSeconds)} 怒赚${formatRmb(fish.sessionSalary)}`;
  if (elements.fishSummary) {
    const hasFishTime = Number(fish.totalSecondsToday || 0) > 0;
    elements.fishSummary.hidden = !hasFishTime;
    elements.fishSummary.innerHTML = hasFishTime
      ? `<span>偷偷摸了${formatMinutes(fish.totalSecondsToday)}</span><span>真正赚了${formatRmb(fish.totalSalaryToday)}</span>`
      : '';
  }
  elements.startFishingButton.disabled = !fish.canStart;
  elements.startFishingCountdownButton.disabled = !fish.canStart;
  elements.fishMinutesInput.disabled = !fish.canStart;
  elements.fishUnavailableText.textContent = fish.canStart ? '' : '工作中才能摸鱼';
  renderFishDetails();
}

function renderFishDetails() {
  if (!elements.fishDetailsList || !elements.fishDetailsEmpty || !latestFish) {
    return;
  }

  const sessions = [
    ...(latestFish.sessionsToday || []),
    ...(latestFish.activeSession ? [latestFish.activeSession] : [])
  ];
  elements.fishDetailsList.innerHTML = '';
  elements.fishDetailsEmpty.hidden = sessions.length > 0;

  for (const session of sessions) {
    const item = document.createElement('p');
    item.className = 'fish-detail-item';
    const minutes = Math.floor(Number(session.durationSeconds || 0) / 60);
    const endText = session.endedAt ? formatClockTime(session.endedAt) : '现在';
    const comment = getFishReviewComment(minutes);
    item.textContent = `今天${formatClockTime(session.startedAt)}-${endText}摸鱼${pad(minutes)}分钟。我的评价是：${comment}`;
    elements.fishDetailsList.appendChild(item);
  }
}

async function startFishing() {
  const fish = await window.xinziAPI.startFishing();
  renderFishState(fish);
}

async function startFishingCountdown() {
  const validation = validateFishCountdownMinutes();
  if (!validation.ok) {
    showFishToast(validation.message);
    return;
  }

  const fish = await window.xinziAPI.startFishingCountdown(validation.minutes);
  renderFishState(fish);
}

async function confirmFishingStop() {
  const fish = await window.xinziAPI.confirmFishingStop();
  renderFishState(fish);
}

async function resumeFishing() {
  const fish = await window.xinziAPI.resumeFishing();
  renderFishState(fish);
}

async function stopAndSaveFishing() {
  const fish = await window.xinziAPI.stopAndSaveFishing();
  renderFishState(fish);
}

async function updateFishingMinutes() {
  const rawValue = getFishMinutesRawValue();
  const validation = parseFishCountdownMinutes(rawValue);
  if (!validation.ok) {
    return;
  }

  const fish = await window.xinziAPI.updateFishingMinutes(validation.minutes);
  renderFishState(fish);
}

function syncFishMinutesInput(defaultMinutes) {
  if (!elements.fishMinutesInput || fishMinutesEditing || document.activeElement === elements.fishMinutesInput) {
    return;
  }

  elements.fishMinutesInput.value = defaultMinutes;
}

function validateFishCountdownMinutes() {
  const rawValue = getFishMinutesRawValue();
  const validation = parseFishCountdownMinutes(rawValue);
  if (validation.emptyOrZero) {
    return {
      ok: false,
      message: '摸鱼0分钟，你是不是卧底'
    };
  }
  if (validation.tooLong) {
    return {
      ok: false,
      message: '摸这么长时间 你想吃鱿鱼吗'
    };
  }
  return validation;
}

function parseFishCountdownMinutes(rawValue) {
  const compactValue = String(rawValue || '').trim();
  const digitValue = compactValue.replace(/[^\d]/g, '');
  const number = Number(compactValue);
  if (!compactValue || !Number.isFinite(number) || number <= 0) {
    return { ok: false, emptyOrZero: true };
  }
  if (digitValue.length >= 4 || number >= 1000) {
    return { ok: false, tooLong: true };
  }

  return {
    ok: true,
    minutes: Math.floor(number)
  };
}

function getFishMinutesRawValue() {
  return elements.fishMinutesInput?.value ?? '';
}

function showFishToast(message) {
  if (!elements.fishToast || !elements.fishToastText) {
    return;
  }

  elements.fishToastText.textContent = message;
  elements.fishToast.hidden = false;
}

function hideFishToast() {
  if (!elements.fishToast) {
    return;
  }

  elements.fishToast.hidden = true;
}

function populateSettings(settings) {
  elements.workStart.value = settings.workStart;
  elements.workEnd.value = settings.workEnd;
  elements.lunchStart.value = settings.lunchStart;
  elements.lunchEnd.value = settings.lunchEnd;
  elements.monthlyWorkDays.value = settings.monthlyWorkDays;
  elements.hireDate.value = settings.hireDate;
  elements.holidayDates.value = (settings.holidayDates || []).join('\n');
  elements.workdayDates.value = (settings.workdayDates || []).join('\n');
  elements.salaryHistoryList.innerHTML = '';
  for (const item of settings.salaryHistory || []) {
    addSalaryRow(item);
  }
  elements.fishReviewRulesList.innerHTML = '';
  for (const rule of settings.fishReviewRules || []) {
    addFishReviewRuleRow(rule);
  }
  formDirty = false;
}

function addSalaryRow(item) {
  const row = document.createElement('div');
  row.className = 'salary-row';
  row.innerHTML = `
    <label>
      生效日期
      <input class="salary-date" type="date" value="${escapeHtml(item.effectiveFrom)}" />
    </label>
    <label>
      月薪 RMB
      <input class="salary-amount" type="number" min="1" step="0.01" value="${Number(item.monthlySalaryRmb || 0)}" />
    </label>
    <button class="small-button danger-button" type="button">删除</button>
  `;
  row.querySelectorAll('input').forEach((input) => input.addEventListener('input', markDirty));
  row.querySelector('button').addEventListener('click', () => {
    row.remove();
    markDirty();
  });
  elements.salaryHistoryList.appendChild(row);
}

function addFishReviewRuleRow(rule) {
  const row = document.createElement('div');
  row.className = 'fish-review-row';
  row.innerHTML = `
    <label>
      最小分钟
      <input class="review-min" type="number" min="0" step="1" value="${Number(rule.minMinutes || 0)}" />
    </label>
    <label>
      最大分钟
      <input class="review-max" type="number" min="0" step="1" value="${rule.maxMinutes === null || rule.maxMinutes === undefined ? '' : Number(rule.maxMinutes)}" placeholder="不限" />
    </label>
    <label>
      评价
      <input class="review-comment" type="text" value="${escapeHtml(rule.comment || '')}" />
    </label>
    <button class="small-button danger-button" type="button">删除</button>
  `;
  row.querySelectorAll('input').forEach((input) => input.addEventListener('input', markDirty));
  row.querySelector('button').addEventListener('click', () => {
    row.remove();
    markDirty();
  });
  elements.fishReviewRulesList.appendChild(row);
}

async function saveSettings() {
  const settings = collectSettings();
  const payload = await window.xinziAPI.saveSettings(settings);
  formDirty = false;
  renderPayload(payload);
  exitSettingsMode();
}

function collectSettings() {
  return {
    ...currentSettings,
    workStart: elements.workStart.value,
    workEnd: elements.workEnd.value,
    lunchStart: elements.lunchStart.value,
    lunchEnd: elements.lunchEnd.value,
    monthlyWorkDays: Number(elements.monthlyWorkDays.value),
    hireDate: elements.hireDate.value,
    salaryHistory: collectSalaryHistory(),
    holidayDates: parseDateList(elements.holidayDates.value),
    workdayDates: parseDateList(elements.workdayDates.value),
    fishReviewRules: collectFishReviewRules()
  };
}

function collectSalaryHistory() {
  const rows = [...elements.salaryHistoryList.querySelectorAll('.salary-row')];
  const history = rows
    .map((row) => ({
      effectiveFrom: row.querySelector('.salary-date').value,
      monthlySalaryRmb: Number(row.querySelector('.salary-amount').value)
    }))
    .filter((item) => item.effectiveFrom && Number.isFinite(item.monthlySalaryRmb) && item.monthlySalaryRmb > 0);

  if (history.length === 0) {
    history.push({
      effectiveFrom: elements.hireDate.value || new Date().toISOString().slice(0, 10),
      monthlySalaryRmb: 10000
    });
  }

  return history;
}

function collectFishReviewRules() {
  const rows = [...elements.fishReviewRulesList.querySelectorAll('.fish-review-row')];
  return rows
    .map((row) => ({
      minMinutes: Number(row.querySelector('.review-min').value),
      maxMinutes: row.querySelector('.review-max').value === '' ? null : Number(row.querySelector('.review-max').value),
      comment: row.querySelector('.review-comment').value.trim()
    }))
    .filter((rule) => (
      Number.isFinite(rule.minMinutes)
      && rule.minMinutes >= 0
      && (rule.maxMinutes === null || (Number.isFinite(rule.maxMinutes) && rule.maxMinutes >= rule.minMinutes))
      && rule.comment
    ));
}

function parseDateList(value) {
  return [...new Set(
    String(value || '')
      .split(/[\s,，;；]+/)
      .map((item) => item.trim())
      .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item))
  )].sort();
}

function markDirty() {
  formDirty = true;
}

function formatRmb(value) {
  return `¥${Number(value || 0).toFixed(2)}`;
}

function formatMinutes(seconds) {
  const minutes = Math.floor(Math.max(0, Number(seconds) || 0) / 60);
  return `${String(minutes).padStart(2, '0')}分钟`;
}

function formatShortFishMinutes(seconds) {
  const minutes = Math.floor(Math.max(0, Number(seconds) || 0) / 60);
  return `${minutes}分`;
}

function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainSeconds = safeSeconds % 60;
  return `${pad(hours)}时${pad(minutes)}分${pad(remainSeconds)}秒`;
}

function formatClockTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '未知';
  }

  return `${pad(date.getHours())}时${pad(date.getMinutes())}分`;
}

function getFishReviewComment(minutes) {
  const rules = currentSettings?.fishReviewRules || [];
  const match = rules.find((rule) => {
    const min = Number(rule.minMinutes);
    const max = rule.maxMinutes === null || rule.maxMinutes === undefined ? null : Number(rule.maxMinutes);
    return Number.isFinite(min) && minutes >= min && (max === null || minutes <= max);
  });

  return match?.comment || '无话可说，继续观察。';
}

function formatPermissionStatus(status) {
  const labels = {
    granted: '已同步',
    online: '在线同步',
    cached: '使用缓存',
    fallback: '周末规则',
    error: '读取失败',
    'not-loaded': '未读取'
  };

  return labels[status] || '未知';
}

function formatCalendarSource(calendar) {
  const labels = {
    online: 'publicHoliday API',
    cached: '本地缓存',
    fallback: '周末规则',
    'not-loaded': '未同步'
  };

  return labels[calendar.source] || calendar.providerName || '未知';
}

function formatCalendarTodayType(calendar) {
  const labels = {
    workday: '调休补班',
    holiday: '休息日',
    unknown: '按周末规则'
  };

  return labels[calendar.todayType] || '按周末规则';
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}
