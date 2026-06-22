const fs = require('node:fs');
const path = require('node:path');

const HIDDEN_METRIC_KEYS = ['totalEarned', 'secondRate', 'employmentDays', 'companyTotal'];

const DEFAULT_UI_STATE = {
  hiddenMetrics: {
    totalEarned: false,
    secondRate: false,
    employmentDays: false,
    companyTotal: false
  }
};

function createUiStateStore(app) {
  const filePath = path.join(app.getPath('userData'), 'ui-state.json');
  let state = load();

  function load() {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      return normalizeUiState(JSON.parse(raw));
    } catch {
      return normalizeUiState(DEFAULT_UI_STATE);
    }
  }

  function save() {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  }

  function getState() {
    return normalizeUiState(state);
  }

  function toggleHiddenMetric(key) {
    if (!HIDDEN_METRIC_KEYS.includes(key)) {
      return getState();
    }

    state.hiddenMetrics[key] = !state.hiddenMetrics[key];
    save();
    return getState();
  }

  return {
    filePath,
    getState,
    toggleHiddenMetric
  };
}

function normalizeUiState(input = {}) {
  const hiddenMetrics = {
    ...DEFAULT_UI_STATE.hiddenMetrics,
    ...(input.hiddenMetrics || {})
  };

  return {
    hiddenMetrics: Object.fromEntries(
      HIDDEN_METRIC_KEYS.map((key) => [key, Boolean(hiddenMetrics[key])])
    )
  };
}

module.exports = {
  HIDDEN_METRIC_KEYS,
  createUiStateStore,
  normalizeUiState
};
