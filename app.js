const STORAGE_KEY = 'home-evening-pwa-state-v1';
const APP_VERSION = 1;

const PROJECT_STEPS = [
  ['只清空书桌左侧 30 厘米', '10 分钟，只分成保留、丢弃、暂存三类'],
  ['丢弃明显垃圾和空包装', '5 分钟，不处理有犹豫的物品'],
  ['整理散落的数据线', '15 分钟，常用和备用分开放'],
  ['给高频物品确定固定位置', '15 分钟，只处理每天会用的物品'],
  ['擦拭桌面并清空暂存箱', '10 分钟，完成项目收尾']
];

const DISH_STATES = [
  ['not_triggered', '未触发'],
  ['dirty', '待清洗'],
  ['drying', '沥水中'],
  ['dry', '已干燥'],
  ['stored', '已入柜']
];

const DISH_GUIDANCE = {
  not_triggered: '今天未使用碗筷，不产生后续提醒。',
  dirty: '今晚计划会加入本次碗筷清洗；只处理当前批次。',
  drying: '清洗完成约 2 小时后检查水珠；未干则延后到次日。',
  dry: '已经可以收进柜子，预计需要 3～5 分钟。',
  stored: '本次碗筷流程结束，不再生成提醒。'
};

const MODE_LABELS = {
  rest: '个人安排计划',
  minimum: '最低维持计划',
  balanced: '平衡计划',
  focus: '集中处理计划'
};

const MODE_BUDGETS = { rest: 0, minimum: 10, balanced: 20, focus: 50 };

const DEFAULT_STATE = {
  version: APP_VERSION,
  settings: {
    city: '',
    arrivalTime: '22:00',
    sleepTime: '02:00',
    gameDeadline: '23:00'
  },
  today: {
    date: '',
    energy: 'medium',
    special: 'none',
    meal: 'none',
    mode: 'balanced',
    plan: [],
    completedPlanIds: []
  },
  tasks: [
    { id: 'task-meal-cleanup', title: '做饭/使用碗筷后的清洁流程', duration: 8, trigger: 'event', energy: 'low', lastDone: '', nextDue: '', custom: false },
    { id: 'task-kitchen', title: '厨房水槽与台面最低维护', duration: 10, trigger: 'weekly', energy: 'low', lastDone: '', nextDue: '', custom: false },
    { id: 'task-bathroom', title: '清理洗手台', duration: 10, trigger: 'weekly', energy: 'low', lastDone: '', nextDue: '', custom: false },
    { id: 'task-bedding', title: '清洗床单、被套和浴巾', duration: 15, trigger: 'weather', energy: 'medium', lastDone: '', nextDue: '', custom: false }
  ],
  deferred: [],
  project: { currentStep: 0 },
  home: {
    dishState: 'not_triggered',
    itemLocations: {
      电池: '客厅 → 电视柜 → 左侧抽屉 → 工具盒',
      卷尺: '客厅 → 电视柜 → 左侧抽屉 → 工具盒',
      洗衣液: '卫生间 → 洗手台下方 → 左侧储物区',
      面霜: '卫生间 → 镜柜 → 中层护肤区',
      维生素: '卧室 → 书桌右侧抽屉 → 保健品盒',
      保健品: '卧室 → 书桌右侧抽屉 → 保健品盒'
    }
  },
  inventory: [
    { id: 'inv-detergent', name: '洗衣液', location: '卫生间洗手台下方', status: 'full', unopened: 2, wishlist: false },
    { id: 'inv-cream', name: '面霜', location: '卫生间镜柜中层', status: 'low', unopened: 0, wishlist: false },
    { id: 'inv-vitamins', name: '维生素', location: '卧室书桌右侧抽屉', status: 'normal', unopened: 1, wishlist: false }
  ],
  purchases: [],
  weather: null,
  review: { weekKey: '', checked: [] },
  completionLog: []
};

const elements = {};
let state = loadState();
let deferredInstallPrompt = null;

document.addEventListener('DOMContentLoaded', init);

function init() {
  cacheElements();
  resetDailyStateIfNeeded();
  resetWeeklyReviewIfNeeded();
  bindEvents();
  hydrateControls();
  if (!state.today.plan.length) generateAndSavePlan(false);
  renderAll();
  setupInstallExperience();
  registerServiceWorker();
}

function cacheElements() {
  [
    'today-label', 'save-status', 'energy-select', 'special-select', 'meal-select', 'generate-plan',
    'summary-chores', 'summary-free', 'summary-shower', 'plan-title', 'plan-note', 'plan-progress',
    'plan-list', 'weather-form', 'city-input', 'weather-source', 'weather-content', 'task-list',
    'task-form', 'task-name', 'task-duration', 'task-trigger', 'task-energy', 'project-progress',
    'project-progress-bar', 'project-next', 'project-meta', 'dish-state-buttons', 'dish-guidance',
    'item-search-form', 'item-search', 'item-search-result', 'area-list', 'inventory-list',
    'inventory-form', 'inventory-name', 'inventory-location', 'inventory-status', 'inventory-unopened',
    'purchase-form', 'purchase-name', 'purchase-amount', 'purchase-category', 'purchase-total',
    'purchase-list', 'review-checklist', 'review-remaining', 'export-data', 'import-data',
    'show-install-help', 'reset-data', 'data-message', 'install-banner', 'install-button',
    'dismiss-install', 'install-hint', 'install-dialog', 'offline-status'
  ].forEach(id => { elements[id] = document.getElementById(id); });
}

function bindEvents() {
  document.querySelectorAll('[data-view-button]').forEach(button => {
    button.addEventListener('click', () => switchView(button.dataset.viewButton));
  });

  elements['generate-plan'].addEventListener('click', () => generateAndSavePlan(true));
  elements['plan-list'].addEventListener('click', handlePlanAction);
  elements['weather-form'].addEventListener('submit', handleWeatherSearch);
  elements['weather-content'].addEventListener('click', handleWeatherAction);
  elements['task-form'].addEventListener('submit', addTask);
  elements['task-list'].addEventListener('click', handleTaskAction);
  elements['project-next'].addEventListener('click', handleProjectAction);
  elements['dish-state-buttons'].addEventListener('click', handleDishState);
  elements['item-search-form'].addEventListener('submit', searchItemLocation);
  elements['inventory-form'].addEventListener('submit', addInventoryItem);
  elements['inventory-list'].addEventListener('click', handleInventoryAction);
  elements['purchase-form'].addEventListener('submit', addPurchase);
  elements['review-checklist'].addEventListener('change', handleReviewCheck);
  elements['export-data'].addEventListener('click', exportData);
  elements['import-data'].addEventListener('change', importData);
  elements['show-install-help'].addEventListener('click', showInstallHelp);
  elements['reset-data'].addEventListener('click', resetData);
  elements['dismiss-install'].addEventListener('click', () => { elements['install-banner'].hidden = true; });
  elements['install-button'].addEventListener('click', installApp);
  window.addEventListener('online', renderConnectionStatus);
  window.addEventListener('offline', renderConnectionStatus);
}

function hydrateControls() {
  elements['energy-select'].value = state.today.energy;
  elements['special-select'].value = state.today.special;
  elements['meal-select'].value = state.today.meal;
  const selectedMode = document.querySelector(`input[name="mode"][value="${state.today.mode}"]`);
  if (selectedMode) selectedMode.checked = true;
  elements['city-input'].value = state.settings.city || '';
}

function renderAll() {
  const date = new Date();
  elements['today-label'].textContent = new Intl.DateTimeFormat('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' }).format(date);
  renderPlan();
  renderWeather();
  renderTasks();
  renderProject();
  renderDishStates();
  renderAreas();
  renderInventory();
  renderPurchases();
  renderReview();
  renderConnectionStatus();
}

function switchView(viewName) {
  document.querySelectorAll('[data-view]').forEach(view => { view.hidden = view.dataset.view !== viewName; });
  document.querySelectorAll('[data-view-button]').forEach(button => {
    const active = button.dataset.viewButton === viewName;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function generateAndSavePlan(showMessage) {
  state.today.energy = elements['energy-select'].value;
  state.today.special = elements['special-select'].value;
  state.today.meal = elements['meal-select'].value;
  state.today.mode = document.querySelector('input[name="mode"]:checked')?.value || 'balanced';

  if (state.today.energy === 'low' && state.today.mode === 'focus') {
    state.today.mode = 'minimum';
    document.querySelector('input[name="mode"][value="minimum"]').checked = true;
  }

  state.home.dishState = state.today.meal === 'none' ? 'not_triggered' : 'dirty';
  state.today.plan = buildPlan();
  state.today.completedPlanIds = [];
  saveState();
  renderPlan();
  renderDishStates();
  renderAreas();
  if (showMessage) flashSaveStatus('计划已更新');
}

function buildPlan() {
  const plan = [];
  let cursor = 0;
  let choreMinutes = 0;
  const requestedBudget = MODE_BUDGETS[state.today.mode];
  const maximumBudget = state.today.special === 'dance_overtime' ? 10 : state.today.special === 'overtime' ? 20 : requestedBudget;
  const plannedBudget = Math.min(requestedBudget, maximumBudget);

  function add(id, title, duration, kind, detail, canDefer = false) {
    plan.push({ id: `${todayKey()}-${id}`, baseId: id, time: formatClock(cursor), title, duration, kind, detail, canDefer });
    cursor += duration;
    if (kind === 'home') choreMinutes += duration;
  }

  add('buffer', '回家缓冲', 10, 'routine', '换衣、喝水，不安排决策');
  add('game', '23:00 前的游戏日常', 45, 'personal', '硬约束：22:55 前结束');

  if (state.today.special === 'dance' || state.today.special === 'dance_overtime') {
    add('dance', '跳舞', 60, 'personal', '完成后再洗澡');
  }

  let mealMinutes = 0;
  if (state.today.meal === 'dishes') {
    mealMinutes = 8;
    add('meal-cleanup', '清洗本次使用的碗筷', 8, 'home', '仅处理本次用过的碗筷');
  } else if (state.today.meal === 'cooked') {
    mealMinutes = 15;
    add('meal-cleanup', '收拾做饭产生的碗筷和台面', 15, 'home', '完成碗筷、水槽和灶台最低清理');
  }

  let remaining = Math.max(0, plannedBudget - mealMinutes);
  const optionalTasks = [
    ['desk', '只整理书桌左侧 30 厘米', 10, '只分成保留、丢弃、暂存', true],
    ['sink', '厨房水槽与台面最低维护', 10, '只处理明显污渍', true],
    ['bathroom', '清理洗手台', 10, '清空台面并擦掉明显水渍', true],
    ['bedroom', '归位卧室散落物品', 10, '只处理有固定位置的物品', true],
    ['trash', '收集明显垃圾', 5, '只收集，不做深度清洁', true],
    ['living', '归位客厅散落物品', 5, '到点即停', true]
  ];
  optionalTasks.forEach(task => {
    if (remaining >= task[2]) {
      add(task[0], task[1], task[2], 'home', task[3], task[4]);
      remaining -= task[2];
    }
  });

  const danced = state.today.special.includes('dance');
  add('shower', '洗澡', 25, 'routine', choreMinutes || danced ? '家务或跳舞结束后洗澡' : '限时游戏结束后直接洗澡');
  add('skincare', '护肤', 10, 'routine', '洗澡后完成基础护肤');

  if (state.today.special === 'overtime') add('overtime', '加班', 90, 'personal', '洗澡和护肤后开始，到点结束');
  if (state.today.special === 'dance_overtime') add('overtime', '加班', 45, 'personal', '因为跳舞，今晚压缩到 45 分钟');

  const freeMinutes = Math.max(0, 210 - cursor);
  if (freeMinutes) add('free', '自由活动与剩余游戏', freeMinutes, 'free', '只安排没有 23:00 限制的游戏、休息或其他事情');
  add('sleep', '睡前收尾并准备入睡', 30, 'routine', '目标 02:00 入睡');

  return plan.map(item => ({ ...item, choreMinutes, freeMinutes, budgetCapped: plannedBudget < requestedBudget }));
}

function renderPlan() {
  const plan = state.today.plan;
  if (!plan.length) return;
  const first = plan[0];
  const shower = plan.find(item => item.baseId === 'shower');
  const actionable = plan.filter(item => item.kind !== 'free');
  const completed = actionable.filter(item => state.today.completedPlanIds.includes(item.id)).length;
  const titleSuffix = first.budgetCapped ? '（已压缩）' : '';

  elements['summary-chores'].textContent = `${first.choreMinutes} 分钟`;
  elements['summary-free'].textContent = `${first.freeMinutes} 分钟`;
  elements['summary-shower'].textContent = shower?.time || '--:--';
  elements['plan-title'].textContent = `${MODE_LABELS[state.today.mode]}${titleSuffix}`;
  elements['plan-note'].textContent = `限时游戏 22:55 前结束，${shower?.time || '之后'} 洗澡。`;
  elements['plan-progress'].textContent = `${completed} / ${actionable.length}`;

  elements['plan-list'].innerHTML = plan.map(item => {
    const done = state.today.completedPlanIds.includes(item.id);
    const freeClass = item.kind === 'free' ? ' free' : '';
    const doneClass = done ? ' done' : '';
    const actions = item.kind === 'free'
      ? '<span class="status-chip">受保护</span>'
      : `<div class="row-actions">${item.canDefer ? `<button class="button" type="button" data-plan-defer="${item.id}">延后</button>` : ''}<button class="button" type="button" data-plan-complete="${item.id}">${done ? '撤销' : '完成'}</button></div>`;
    return `<article class="list-row plan-row${freeClass}${doneClass}"><time class="time">${item.time}</time><div><div class="row-title">${escapeHtml(item.title)}</div><div class="row-meta">${item.duration} 分钟 · ${escapeHtml(item.detail)}</div></div>${actions}</article>`;
  }).join('');
}

function handlePlanAction(event) {
  const completeButton = event.target.closest('[data-plan-complete]');
  const deferButton = event.target.closest('[data-plan-defer]');
  if (completeButton) {
    const id = completeButton.dataset.planComplete;
    const item = state.today.plan.find(planItem => planItem.id === id);
    const index = state.today.completedPlanIds.indexOf(id);
    if (index >= 0) {
      state.today.completedPlanIds.splice(index, 1);
      state.completionLog = state.completionLog.filter(log => !(log.date === todayKey() && log.planId === id));
    } else {
      state.today.completedPlanIds.push(id);
      state.completionLog.push({ date: todayKey(), planId: id, title: item?.title || '', duration: item?.duration || 0, kind: item?.kind || '' });
      if (item?.baseId === 'meal-cleanup') state.home.dishState = 'drying';
    }
    saveState();
    renderPlan();
    renderDishStates();
  }
  if (deferButton) {
    const id = deferButton.dataset.planDefer;
    const item = state.today.plan.find(planItem => planItem.id === id);
    if (!item) return;
    state.deferred.push({ id: uid('defer'), title: item.title, originalDate: todayKey(), targetDate: addDays(todayKey(), 1), duration: item.duration, energy: state.today.energy });
    const remainingPlan = state.today.plan.filter(planItem => planItem.id !== id);
    const freeItem = remainingPlan.find(planItem => planItem.kind === 'free');
    if (freeItem) {
      freeItem.duration += item.duration;
      freeItem.detail = '因任务延期而增加；只安排没有 23:00 限制的游戏、休息或其他事情';
    }
    state.today.plan = reflowPlan(remainingPlan);
    saveState();
    renderPlan();
    flashSaveStatus('已延后到明天');
  }
}

function reflowPlan(plan) {
  let cursor = 0;
  const choreMinutes = plan.filter(item => item.kind === 'home').reduce((sum, item) => sum + item.duration, 0);
  const freeMinutes = plan.find(item => item.kind === 'free')?.duration || 0;
  return plan.map(item => {
    const updated = { ...item, time: formatClock(cursor), choreMinutes, freeMinutes };
    cursor += item.duration;
    return updated;
  });
}

async function handleWeatherSearch(event) {
  event.preventDefault();
  const city = elements['city-input'].value.trim();
  if (!city) return;
  elements['weather-source'].textContent = '正在查询';
  elements['weather-content'].innerHTML = '<p class="empty-state">正在获取天气预报…</p>';
  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh&format=json`;
    const geoResponse = await fetch(geoUrl);
    if (!geoResponse.ok) throw new Error('城市查询失败');
    const geo = await geoResponse.json();
    const place = geo.results?.[0];
    if (!place) throw new Error('没有找到这个城市');

    const params = new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      daily: 'weather_code,temperature_2m_max,precipitation_probability_max,precipitation_sum,sunshine_duration',
      forecast_days: '7',
      timezone: 'auto'
    });
    const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!weatherResponse.ok) throw new Error('天气查询失败');
    const weather = await weatherResponse.json();
    const daily = weather.daily.time.map((date, index) => ({
      date,
      code: weather.daily.weather_code[index],
      maxTemp: weather.daily.temperature_2m_max[index],
      precipitationProbability: weather.daily.precipitation_probability_max[index] ?? 0,
      precipitation: weather.daily.precipitation_sum[index] ?? 0,
      sunshineHours: Math.round(((weather.daily.sunshine_duration[index] || 0) / 3600) * 10) / 10
    }));
    state.settings.city = place.name;
    state.weather = { city: place.name, admin: place.admin1 || '', updatedAt: new Date().toISOString(), daily };
    saveState();
    renderWeather();
  } catch (error) {
    elements['weather-source'].textContent = navigator.onLine ? '查询失败' : '当前离线';
    elements['weather-content'].innerHTML = `<p class="empty-state">${escapeHtml(error.message)}。${state.weather ? '仍可使用上次保存的预报。' : '请检查城市名称或网络后重试。'}</p>`;
  }
}

function renderWeather() {
  if (!state.weather?.daily?.length) return;
  const recommendation = chooseLaundryDay(state.weather.daily);
  elements['weather-source'].textContent = `${state.weather.city} · 已缓存`;
  elements['city-input'].value = state.settings.city || state.weather.city;
  elements['weather-content'].innerHTML = `
    <div class="weather-grid">
      ${state.weather.daily.map(day => `<article class="weather-day${day.date === recommendation.date ? ' best' : ''}"><strong>${formatShortDate(day.date)}</strong><span>${weatherText(day.code)} · ${Math.round(day.maxTemp)}°C</span><span>降水 ${day.precipitationProbability}% · 日照 ${day.sunshineHours}h</span></article>`).join('')}
    </div>
    <div class="recommendation">
      <strong>推荐 ${formatLongDate(recommendation.date)} 09:30 洗床品</strong>
      <p class="helper-text">${recommendation.precipitationProbability}% 降水概率，预计日照 ${recommendation.sunshineHours} 小时。天气变化时重新查询即可调整。</p>
      <button class="button primary" type="button" data-weather-adopt="${recommendation.date}">加入任务</button>
    </div>`;
}

function chooseLaundryDay(days) {
  return [...days].sort((a, b) => laundryScore(b) - laundryScore(a))[0];
}

function laundryScore(day) {
  const weekday = new Date(`${day.date}T12:00:00`).getDay();
  const weekendBonus = weekday === 0 || weekday === 6 ? 30 : weekday === 5 ? 12 : 0;
  return weekendBonus + day.sunshineHours * 5 - day.precipitationProbability - day.precipitation * 12;
}

function handleWeatherAction(event) {
  const button = event.target.closest('[data-weather-adopt]');
  if (!button) return;
  const date = button.dataset.weatherAdopt;
  const existing = state.tasks.find(task => task.id === 'task-bedding');
  if (existing) existing.nextDue = date;
  else state.tasks.push({ id: 'task-bedding', title: '清洗床单、被套和浴巾', duration: 15, trigger: 'weather', energy: 'medium', lastDone: '', nextDue: date, custom: false });
  saveState();
  renderTasks();
  button.disabled = true;
  button.textContent = '已加入任务';
  flashSaveStatus('已加入洗涤任务');
}

function renderTasks() {
  const deferredRows = state.deferred.map(item => ({ ...item, isDeferred: true }));
  const tasks = [...deferredRows, ...state.tasks];
  elements['task-list'].innerHTML = tasks.map(task => {
    const due = task.isDeferred ? `延期到 ${formatShortDate(task.targetDate)}` : task.trigger === 'event' ? '按事件触发' : task.nextDue ? `下次 ${formatShortDate(task.nextDue)}` : triggerLabel(task.trigger);
    const action = task.trigger === 'event'
      ? '<span class="status-chip">非固定周期</span>'
      : task.isDeferred
        ? `<div class="row-actions"><button class="button" type="button" data-deferred-complete="${task.id}">完成</button></div>`
        : `<div class="row-actions"><button class="button" type="button" data-task-defer="${task.id}">延后</button><button class="button" type="button" data-task-complete="${task.id}">完成</button>${task.custom ? `<button class="button" type="button" data-task-delete="${task.id}">删除</button>` : ''}</div>`;
    const energy = energyLabel(task.energy || 'medium');
    return `<article class="list-row"><div><div class="row-title">${escapeHtml(task.title)}</div><div class="row-meta">${task.duration} 分钟 · ${due} · ${energy}</div></div>${action}</article>`;
  }).join('') || '<p class="empty-state">还没有任务。</p>';
}

function addTask(event) {
  event.preventDefault();
  state.tasks.push({
    id: uid('task'),
    title: elements['task-name'].value.trim(),
    duration: Number(elements['task-duration'].value),
    trigger: elements['task-trigger'].value,
    energy: elements['task-energy'].value,
    lastDone: '',
    nextDue: '',
    custom: true
  });
  event.target.reset();
  saveState();
  renderTasks();
  flashSaveStatus('任务已保存');
}

function handleTaskAction(event) {
  const deferButton = event.target.closest('[data-task-defer]');
  const completeButton = event.target.closest('[data-task-complete]');
  const deleteButton = event.target.closest('[data-task-delete]');
  const deferredComplete = event.target.closest('[data-deferred-complete]');

  if (deferButton) {
    const task = state.tasks.find(item => item.id === deferButton.dataset.taskDefer);
    if (task) task.nextDue = addDays(task.nextDue || todayKey(), 1);
  }
  if (completeButton) {
    const task = state.tasks.find(item => item.id === completeButton.dataset.taskComplete);
    if (task) {
      task.lastDone = todayKey();
      task.nextDue = nextDueForTask(task);
      state.completionLog.push({ date: todayKey(), planId: task.id, title: task.title, duration: task.duration, kind: 'home' });
    }
  }
  if (deleteButton) state.tasks = state.tasks.filter(item => item.id !== deleteButton.dataset.taskDelete);
  if (deferredComplete) state.deferred = state.deferred.filter(item => item.id !== deferredComplete.dataset.deferredComplete);
  saveState();
  renderTasks();
}

function renderProject() {
  const current = state.project.currentStep;
  const total = PROJECT_STEPS.length;
  elements['project-progress'].textContent = `${current} / ${total}`;
  elements['project-progress-bar'].style.width = `${(current / total) * 100}%`;
  if (current >= total) {
    elements['project-meta'].textContent = '项目已完成，后续只做周期性维持。';
    elements['project-next'].innerHTML = '<strong>书桌整理完成</strong>';
    return;
  }
  const step = PROJECT_STEPS[current];
  elements['project-next'].innerHTML = `<strong>下一步：${step[0]}</strong><p class="helper-text">${step[1]}</p><button class="button primary" type="button" data-project-complete>完成这一步</button>`;
}

function handleProjectAction(event) {
  if (!event.target.closest('[data-project-complete]')) return;
  state.project.currentStep = Math.min(PROJECT_STEPS.length, state.project.currentStep + 1);
  saveState();
  renderProject();
}

function renderDishStates() {
  elements['dish-state-buttons'].innerHTML = DISH_STATES.map(([value, label]) => `<button class="state-button${state.home.dishState === value ? ' active' : ''}" type="button" data-dish-state="${value}">${label}</button>`).join('');
  elements['dish-guidance'].textContent = DISH_GUIDANCE[state.home.dishState];
}

function handleDishState(event) {
  const button = event.target.closest('[data-dish-state]');
  if (!button) return;
  state.home.dishState = button.dataset.dishState;
  saveState();
  renderDishStates();
  renderAreas();
}

function renderAreas() {
  const kitchenStatus = state.home.dishState === 'not_triggered' || state.home.dishState === 'stored' ? '正常' : '有用餐清理';
  const areas = [
    ['厨房', kitchenStatus, state.home.dishState === 'not_triggered' ? '今晚未使用碗筷' : DISH_GUIDANCE[state.home.dishState]],
    ['卫生间', '正常', '面霜库存偏低，洗手台按周维护'],
    ['卧室', '有整理项目', `书桌整理完成 ${state.project.currentStep} / ${PROJECT_STEPS.length}`],
    ['客厅', '状态良好', '工具和电池位置已记录']
  ];
  elements['area-list'].innerHTML = areas.map(area => `<article class="area-card"><strong>${area[0]} · ${area[1]}</strong><p>${escapeHtml(area[2])}</p></article>`).join('');
}

function searchItemLocation(event) {
  event.preventDefault();
  const query = elements['item-search'].value.trim();
  const allLocations = { ...state.home.itemLocations };
  state.inventory.forEach(item => { allLocations[item.name] = item.location; });
  const key = Object.keys(allLocations).find(name => name.includes(query) || query.includes(name));
  elements['item-search-result'].textContent = key ? `${key}：${allLocations[key]}` : `暂未记录“${query}”。可以在采购页新增库存物品和位置。`;
}

function renderInventory() {
  elements['inventory-list'].innerHTML = state.inventory.map(item => `<article class="list-row"><div><div class="row-title">${escapeHtml(item.name)} <span class="status-chip">${inventoryStatusLabel(item.status)}</span></div><div class="row-meta">${escapeHtml(item.location)} · 未开封 ${item.unopened} 件${item.wishlist ? ' · 已加入待购' : ''}</div></div><div class="row-actions"><button class="button" type="button" data-inventory-cycle="${item.id}">更新状态</button><button class="button" type="button" data-inventory-wishlist="${item.id}">${item.wishlist ? '移出待购' : '加入待购'}</button></div></article>`).join('');
}

function addInventoryItem(event) {
  event.preventDefault();
  state.inventory.push({
    id: uid('inv'),
    name: elements['inventory-name'].value.trim(),
    location: elements['inventory-location'].value.trim(),
    status: elements['inventory-status'].value,
    unopened: Number(elements['inventory-unopened'].value || 0),
    wishlist: false
  });
  event.target.reset();
  saveState();
  renderInventory();
}

function handleInventoryAction(event) {
  const cycleButton = event.target.closest('[data-inventory-cycle]');
  const wishlistButton = event.target.closest('[data-inventory-wishlist]');
  if (cycleButton) {
    const item = state.inventory.find(entry => entry.id === cycleButton.dataset.inventoryCycle);
    if (item) item.status = item.status === 'full' ? 'normal' : item.status === 'normal' ? 'low' : 'full';
  }
  if (wishlistButton) {
    const item = state.inventory.find(entry => entry.id === wishlistButton.dataset.inventoryWishlist);
    if (item) item.wishlist = !item.wishlist;
  }
  saveState();
  renderInventory();
}

function addPurchase(event) {
  event.preventDefault();
  state.purchases.unshift({
    id: uid('purchase'),
    date: todayKey(),
    name: elements['purchase-name'].value.trim(),
    amount: Number(elements['purchase-amount'].value),
    category: elements['purchase-category'].value
  });
  event.target.reset();
  saveState();
  renderPurchases();
}

function renderPurchases() {
  const currentMonth = todayKey().slice(0, 7);
  const total = state.purchases.filter(item => item.date.startsWith(currentMonth)).reduce((sum, item) => sum + item.amount, 0);
  elements['purchase-total'].textContent = `本月已记录 ¥${total.toFixed(2)}`;
  elements['purchase-list'].innerHTML = state.purchases.length
    ? state.purchases.slice(0, 10).map(item => `<article class="list-row"><div><div class="row-title">${escapeHtml(item.name)}</div><div class="row-meta">${formatShortDate(item.date)} · ${escapeHtml(item.category)}</div></div><strong>¥${item.amount.toFixed(2)}</strong></article>`).join('')
    : '<p class="empty-state">还没有购买记录。</p>';
}

function renderReview() {
  const reviewItems = [
    ['deferred', '处理延期任务', 10],
    ['inventory', '检查洗护和保健品库存', 10],
    ['purchases', '补充遗漏的家庭购买记录', 5],
    ['rules', '调整不合理的任务周期', 5]
  ];
  elements['review-checklist'].innerHTML = reviewItems.map(item => `<label class="check-row${state.review.checked.includes(item[0]) ? ' done' : ''}"><input type="checkbox" data-review-id="${item[0]}" data-review-minutes="${item[2]}" ${state.review.checked.includes(item[0]) ? 'checked' : ''}><span>${item[1]} · ${item[2]} 分钟</span></label>`).join('');
  const used = reviewItems.filter(item => state.review.checked.includes(item[0])).reduce((sum, item) => sum + item[2], 0);
  elements['review-remaining'].textContent = `剩余 ${30 - used} 分钟`;
}

function handleReviewCheck(event) {
  const checkbox = event.target.closest('[data-review-id]');
  if (!checkbox) return;
  const id = checkbox.dataset.reviewId;
  if (checkbox.checked && !state.review.checked.includes(id)) state.review.checked.push(id);
  if (!checkbox.checked) state.review.checked = state.review.checked.filter(item => item !== id);
  saveState();
  renderReview();
}

function exportData() {
  const payload = JSON.stringify({ exportedAt: new Date().toISOString(), app: 'home-evening-pwa', state }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `今晚做什么-备份-${todayKey()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  elements['data-message'].textContent = '备份已导出。建议保存到 iCloud Drive。';
}

async function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const importedState = parsed.state || parsed;
    if (!importedState || !Array.isArray(importedState.tasks) || !Array.isArray(importedState.inventory)) throw new Error('文件格式不正确');
    state = mergeWithDefaults(importedState);
    saveState();
    hydrateControls();
    renderAll();
    elements['data-message'].textContent = '数据恢复成功。';
  } catch (error) {
    elements['data-message'].textContent = `导入失败：${error.message}`;
  } finally {
    event.target.value = '';
  }
}

function resetData() {
  if (!window.confirm('确定删除当前设备中的全部记录吗？建议先导出备份。')) return;
  state = structuredClone(DEFAULT_STATE);
  resetDailyStateIfNeeded();
  resetWeeklyReviewIfNeeded();
  localStorage.removeItem(STORAGE_KEY);
  saveState();
  hydrateControls();
  generateAndSavePlan(false);
  renderAll();
  elements['data-message'].textContent = '数据已重置。';
}

function setupInstallExperience() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (isStandalone) return;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIos) {
    elements['install-banner'].hidden = false;
    elements['install-hint'].textContent = '在 Safari 中点击“分享”→“添加到主屏幕”。';
    elements['install-button'].textContent = '查看步骤';
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    elements['install-banner'].hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    elements['install-banner'].hidden = true;
    deferredInstallPrompt = null;
  });
}

async function installApp() {
  if (!deferredInstallPrompt) {
    showInstallHelp();
    return;
  }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  elements['install-banner'].hidden = true;
}

function showInstallHelp() {
  if (typeof elements['install-dialog'].showModal === 'function') elements['install-dialog'].showModal();
  else elements['data-message'].textContent = '请在 Safari 中点击“分享”，然后选择“添加到主屏幕”。';
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    elements['offline-status'].textContent = '此浏览器不支持离线安装';
    return;
  }
  try {
    await navigator.serviceWorker.register('./sw.js');
    elements['offline-status'].textContent = '已启用离线访问';
  } catch (error) {
    elements['offline-status'].textContent = location.protocol === 'file:' ? '请通过网页地址访问以启用离线' : '离线功能注册失败';
  }
}

function renderConnectionStatus() {
  if (!navigator.onLine) elements['offline-status'].textContent = '当前离线 · 使用本机数据';
  else if (!('serviceWorker' in navigator)) elements['offline-status'].textContent = '在线 · 不支持离线安装';
}

function saveState() {
  state.version = APP_VERSION;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  flashSaveStatus('已保存在本机');
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? mergeWithDefaults(JSON.parse(raw)) : structuredClone(DEFAULT_STATE);
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function mergeWithDefaults(saved) {
  const merged = structuredClone(DEFAULT_STATE);
  Object.assign(merged, saved);
  merged.settings = { ...merged.settings, ...(saved.settings || {}) };
  merged.today = { ...merged.today, ...(saved.today || {}) };
  merged.home = { ...merged.home, ...(saved.home || {}), itemLocations: { ...merged.home.itemLocations, ...(saved.home?.itemLocations || {}) } };
  merged.review = { ...merged.review, ...(saved.review || {}) };
  return merged;
}

function resetDailyStateIfNeeded() {
  const today = todayKey();
  if (state.today.date === today) return;
  state.today = { ...state.today, date: today, plan: [], completedPlanIds: [], meal: 'none' };
  state.home.dishState = 'not_triggered';
  saveState();
}

function resetWeeklyReviewIfNeeded() {
  const key = weekKey();
  if (state.review.weekKey === key) return;
  state.review = { weekKey: key, checked: [] };
  saveState();
}

function flashSaveStatus(message) {
  if (!elements['save-status']) return;
  elements['save-status'].textContent = message;
  window.clearTimeout(flashSaveStatus.timer);
  flashSaveStatus.timer = window.setTimeout(() => { elements['save-status'].textContent = '已保存在本机'; }, 1600);
}

function nextDueForTask(task) {
  if (task.trigger === 'daily') return addDays(todayKey(), 1);
  if (task.trigger === 'after14') return addDays(todayKey(), 14);
  if (task.trigger === 'after30') return addDays(todayKey(), 30);
  if (task.trigger === 'weekly') return addDays(todayKey(), 7);
  return '';
}

function triggerLabel(trigger) {
  return ({ daily: '每天', weekly: '每周一次', after14: '完成后 14 天', after30: '完成后 30 天', event: '按事件触发', weather: '达到周期后看天气' })[trigger] || trigger;
}

function energyLabel(energy) {
  return ({ low: '低精力', medium: '中精力', high: '高精力' })[energy] || energy;
}

function inventoryStatusLabel(status) {
  return ({ full: '充足', normal: '一般', low: '快用完' })[status] || status;
}

function weatherText(code) {
  if (code === 0) return '晴';
  if ([1, 2, 3].includes(code)) return '多云';
  if ([45, 48].includes(code)) return '雾';
  if ([51, 53, 55, 56, 57].includes(code)) return '毛毛雨';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return '雨';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return '雪';
  if ([95, 96, 99].includes(code)) return '雷雨';
  return '天气变化';
}

function formatClock(offsetMinutes) {
  const absolute = (22 * 60 + offsetMinutes) % (24 * 60);
  return `${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function weekKey() {
  const now = new Date();
  const day = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - day);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatShortDate(dateString) {
  if (!dateString) return '未设置';
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short' }).format(new Date(`${dateString}T12:00:00`));
}

function formatLongDate(dateString) {
  return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date(`${dateString}T12:00:00`));
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}
