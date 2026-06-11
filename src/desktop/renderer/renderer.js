const view = new URLSearchParams(window.location.search).get('view') || 'popover';
document.body.dataset.view = view;

const elements = {
  statusPill: document.querySelector('#statusPill'),
  earnedToday: document.querySelector('#earnedToday'),
  workedTime: document.querySelector('#workedTime'),
  remainingTime: document.querySelector('#remainingTime'),
  monthlySalary: document.querySelector('#monthlySalary'),
  secondRate: document.querySelector('#secondRate'),
  employmentDays: document.querySelector('#employmentDays'),
  totalEarned: document.querySelector('#totalEarned'),
  openMainButton: document.querySelector('#openMainButton'),
  showPopoverButton: document.querySelector('#showPopoverButton'),
  saveSettingsButton: document.querySelector('#saveSettingsButton'),
  addSalaryButton: document.querySelector('#addSalaryButton'),
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
let formDirty = false;
let hideTimer = null;

elements.openMainButton?.addEventListener('click', () => window.xinziAPI.openMainWindow());
elements.showPopoverButton?.addEventListener('click', () => window.xinziAPI.showPopover());
elements.saveSettingsButton?.addEventListener('click', () => saveSettings());
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
  window.xinziAPI.getClockState()
]).then(([settings, state]) => renderPayload({ settings, state }));

function renderPayload(payload) {
  currentSettings = payload.settings;
  renderState(payload.state);
  if (view === 'main' && !formDirty) {
    populateSettings(payload.settings);
  }
}

function renderState(state) {
  const isOff = state.status === 'off' || state.status === 'holiday';
  elements.statusPill.textContent = state.statusText;
  elements.statusPill.className = `status-pill ${state.status}`;
  elements.earnedToday.textContent = isOff ? '不要工作了' : formatRmb(state.earnedTodayRmb);
  elements.workedTime.textContent = isOff ? '不要工作了' : formatDuration(state.workedSecondsToday);
  elements.remainingTime.textContent = isOff ? '不要工作了' : formatDuration(state.remainingSecondsToOff);
  elements.monthlySalary.textContent = formatRmb(state.monthlySalaryRmb);
  elements.secondRate.textContent = `¥${Number(state.secondRateRmb || 0).toFixed(4)}`;
  elements.employmentDays.textContent = `${state.employmentDays} 天`;
  elements.totalEarned.textContent = formatRmb(state.totalEarnedRmb);
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

async function saveSettings() {
  const settings = collectSettings();
  const payload = await window.xinziAPI.saveSettings(settings);
  formDirty = false;
  renderPayload(payload);
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
    workdayDates: parseDateList(elements.workdayDates.value)
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

function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainSeconds = safeSeconds % 60;
  return `${pad(hours)}时${pad(minutes)}分${pad(remainSeconds)}秒`;
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
