const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_STATE = {
  date: '',
  status: 'idle',
  defaultMinutes: 10,
  countdownStartedAt: null,
  countdownSeconds: 3,
  sessionStartedAt: null,
  accumulatedSecondsToday: 0,
  accumulatedSalaryToday: 0,
  sessionsToday: []
};

function createFishStateStore(app, { now = () => new Date() } = {}) {
  const filePath = path.join(app.getPath('userData'), 'fish-state.json');
  let state = load();

  function load() {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      return normalizeState(JSON.parse(raw), now());
    } catch {
      return normalizeState(DEFAULT_STATE, now());
    }
  }

  function save() {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  }

  function getSnapshot(clockState, referenceDate = now()) {
    resetIfNewDay(referenceDate);
    advanceCountdown(referenceDate);
    autoStopIfNeeded(clockState, referenceDate);
    save();
    return buildSnapshot(clockState, referenceDate);
  }

  function start(clockState, referenceDate = now()) {
    resetIfNewDay(referenceDate);
    if (clockState.status !== 'working') {
      return getSnapshot(clockState, referenceDate);
    }

    state.status = 'active';
    state.countdownStartedAt = null;
    state.sessionStartedAt = referenceDate.toISOString();
    save();
    return buildSnapshot(clockState, referenceDate);
  }

  function startCountdown(minutes, clockState, referenceDate = now()) {
    resetIfNewDay(referenceDate);
    state.defaultMinutes = normalizeMinutes(minutes, state.defaultMinutes);
    if (clockState.status !== 'working') {
      save();
      return getSnapshot(clockState, referenceDate);
    }

    state.status = 'countdown';
    state.countdownStartedAt = referenceDate.toISOString();
    state.sessionStartedAt = null;
    save();
    return buildSnapshot(clockState, referenceDate);
  }

  function confirmStop(clockState, referenceDate = now()) {
    resetIfNewDay(referenceDate);
    if (state.status === 'active') {
      state.status = 'confirmStop';
      save();
    }
    return buildSnapshot(clockState, referenceDate);
  }

  function resume(clockState, referenceDate = now()) {
    resetIfNewDay(referenceDate);
    if (state.status === 'confirmStop') {
      state.status = 'active';
      save();
    }
    return buildSnapshot(clockState, referenceDate);
  }

  function stopAndSave(clockState, referenceDate = now()) {
    resetIfNewDay(referenceDate);
    if (state.status === 'active' || state.status === 'confirmStop') {
      persistActiveSession(clockState, referenceDate);
      state.status = 'idle';
      state.sessionStartedAt = null;
      state.countdownStartedAt = null;
      save();
    }
    return buildSnapshot(clockState, referenceDate);
  }

  function updateDefaultMinutes(minutes, clockState, referenceDate = now()) {
    resetIfNewDay(referenceDate);
    state.defaultMinutes = normalizeMinutes(minutes, state.defaultMinutes);
    save();
    return buildSnapshot(clockState, referenceDate);
  }

  function resetIfNewDay(referenceDate) {
    const dateKey = formatDateKey(referenceDate);
    if (state.date === dateKey) {
      return;
    }

    state = {
      ...DEFAULT_STATE,
      date: dateKey,
      defaultMinutes: normalizeMinutes(state.defaultMinutes, DEFAULT_STATE.defaultMinutes)
    };
  }

  function advanceCountdown(referenceDate) {
    if (state.status !== 'countdown' || !state.countdownStartedAt) {
      return;
    }

    const elapsedSeconds = secondsBetween(new Date(state.countdownStartedAt), referenceDate);
    if (elapsedSeconds >= state.countdownSeconds) {
      state.status = 'active';
      state.countdownStartedAt = null;
      state.sessionStartedAt = referenceDate.toISOString();
    }
  }

  function autoStopIfNeeded(clockState, referenceDate) {
    if ((state.status === 'active' || state.status === 'confirmStop') && clockState.status !== 'working') {
      persistActiveSession(clockState, referenceDate);
      state.status = 'idle';
      state.sessionStartedAt = null;
      state.countdownStartedAt = null;
    }
  }

  function persistActiveSession(clockState, referenceDate) {
    const sessionSeconds = getSessionSeconds(referenceDate);
    const salaryRmb = sessionSeconds * Number(clockState.secondRateRmb || 0);
    if (sessionSeconds > 0 && state.sessionStartedAt) {
      state.sessionsToday.push({
        startedAt: state.sessionStartedAt,
        endedAt: referenceDate.toISOString(),
        durationSeconds: sessionSeconds,
        salaryRmb
      });
    }
    state.accumulatedSecondsToday += sessionSeconds;
    state.accumulatedSalaryToday += salaryRmb;
  }

  function buildSnapshot(clockState, referenceDate) {
    const activeSeconds = state.status === 'active' || state.status === 'confirmStop'
      ? getSessionSeconds(referenceDate)
      : 0;
    const activeSalary = activeSeconds * Number(clockState.secondRateRmb || 0);
    const countdownRemainingSeconds = state.status === 'countdown'
      ? Math.max(0, state.countdownSeconds - secondsBetween(new Date(state.countdownStartedAt), referenceDate))
      : 0;

    const activeSession = activeSeconds > 0 && state.sessionStartedAt
      ? {
        startedAt: state.sessionStartedAt,
        endedAt: null,
        durationSeconds: activeSeconds,
        salaryRmb: activeSalary
      }
      : null;

    return {
      date: state.date,
      status: state.status,
      defaultMinutes: state.defaultMinutes,
      canStart: clockState.status === 'working',
      countdownRemainingSeconds,
      sessionSeconds: activeSeconds,
      sessionSalary: activeSalary,
      accumulatedSecondsToday: state.accumulatedSecondsToday,
      accumulatedSalaryToday: state.accumulatedSalaryToday,
      totalSecondsToday: state.accumulatedSecondsToday + activeSeconds,
      totalSalaryToday: state.accumulatedSalaryToday + activeSalary,
      sessionsToday: [...state.sessionsToday],
      activeSession
    };
  }

  function getSessionSeconds(referenceDate) {
    return state.sessionStartedAt
      ? secondsBetween(new Date(state.sessionStartedAt), referenceDate)
      : 0;
  }

  return {
    filePath,
    getSnapshot,
    start,
    startCountdown,
    confirmStop,
    resume,
    stopAndSave,
    updateDefaultMinutes
  };
}

function normalizeState(input, date) {
  const base = {
    ...DEFAULT_STATE,
    ...input
  };

  return {
    date: typeof base.date === 'string' && base.date ? base.date : formatDateKey(date),
    status: ['idle', 'countdown', 'active', 'confirmStop'].includes(base.status) ? base.status : 'idle',
    defaultMinutes: normalizeMinutes(base.defaultMinutes, DEFAULT_STATE.defaultMinutes),
    countdownStartedAt: normalizeIsoDate(base.countdownStartedAt),
    countdownSeconds: positiveInteger(base.countdownSeconds, DEFAULT_STATE.countdownSeconds),
    sessionStartedAt: normalizeIsoDate(base.sessionStartedAt),
    accumulatedSecondsToday: positiveInteger(base.accumulatedSecondsToday, 0),
    accumulatedSalaryToday: positiveNumber(base.accumulatedSalaryToday, 0),
    sessionsToday: normalizeSessions(base.sessionsToday)
  };
}

function normalizeSessions(sessions) {
  if (!Array.isArray(sessions)) {
    return [];
  }

  return sessions
    .map((session) => ({
      startedAt: normalizeIsoDate(session?.startedAt),
      endedAt: normalizeIsoDate(session?.endedAt),
      durationSeconds: positiveInteger(session?.durationSeconds, 0),
      salaryRmb: positiveNumber(session?.salaryRmb, 0)
    }))
    .filter((session) => session.startedAt && session.endedAt && session.durationSeconds > 0);
}

function normalizeMinutes(value, fallback) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number >= 1 && number <= 180 ? number : fallback;
}

function normalizeIsoDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null;
}

function positiveInteger(value, fallback) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function secondsBetween(start, end) {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = {
  createFishStateStore,
  normalizeState
};
