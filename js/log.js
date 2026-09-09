// ─── Log tab toggle ────────────────────────────────────────────
function switchLogTab(tab, btn) {
  document.querySelectorAll('.log-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('log-tab-photo').style.display = tab === 'photo' ? 'block' : 'none';
  document.getElementById('log-tab-manual').style.display = tab === 'manual' ? 'block' : 'none';
  document.getElementById('log-tab-exercise').style.display = tab === 'exercise' ? 'block' : 'none';
  if (tab === 'manual') renderQuickAdd();
}

// ─── Exercise ──────────────────────────────────────────────────
function selectActivity(btn, name, baseMet) {
  document.querySelectorAll('.activity-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state._exercise.name = name;
  state._exercise.baseMet = baseMet;
  const isOther = name === 'Other';
  document.getElementById('custom-activity-wrap').style.display = isOther ? 'block' : 'none';
  if (isOther) {
    setTimeout(() => document.getElementById('custom-activity-input').focus(), 50);
  }
  updateBurnPreview();
}

function selectIntensity(btn, mult) {
  document.querySelectorAll('.intensity-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state._exercise.intensityMult = mult;
  const labels = { 0.7: 'Light', 1.0: 'Moderate', 1.35: 'Hard', 1.75: 'Intense' };
  state._exercise.intensityLabel = labels[mult] || 'Moderate';
  updateBurnPreview();
}

function setDuration(mins) {
  document.getElementById('duration-input').value = mins;
  updateBurnPreview();
}

function calcBurn(baseMet, intensityMult, durationMins, weightLbs) {
  const weightKg = weightLbs * 0.453592;
  const hours = durationMins / 60;
  return Math.round(baseMet * intensityMult * weightKg * hours);
}

function getActivityName() {
  const { name } = state._exercise;
  if (name === 'Other') {
    const custom = document.getElementById('custom-activity-input').value.trim();
    return custom || 'Other activity';
  }
  return name;
}

function currentWeightLbs() {
  const w = state.settings.userWeight.start || 200;
  return state.settings.units === 'kg' ? w * 2.20462 : w;
}

function updateBurnPreview() {
  const { name, baseMet, intensityMult, intensityLabel } = state._exercise;
  const duration = parseInt(document.getElementById('duration-input').value) || 0;
  const weightLbs = currentWeightLbs();
  const displayName = getActivityName();

  if (!name || !baseMet || duration < 1) {
    document.getElementById('burn-val').textContent = '—';
    document.getElementById('burn-note').textContent = name ? 'Enter a duration above' : 'Select an activity above';
    return;
  }
  const burn = calcBurn(baseMet, intensityMult, duration, weightLbs);
  document.getElementById('burn-val').textContent = burn + ' cal';
  document.getElementById('burn-note').textContent = `${duration} min ${intensityLabel.toLowerCase()} ${displayName.toLowerCase()} · based on ${Math.round(state.settings.userWeight.start || 200)} ${state.settings.units}`;
}

function logExercise() {
  const { name, baseMet, intensityMult, intensityLabel } = state._exercise;
  const duration = parseInt(document.getElementById('duration-input').value) || 0;
  const weightLbs = currentWeightLbs();
  const displayName = getActivityName();

  if (!name) { showToast('Select an activity first'); return; }
  if (name === 'Other' && displayName === 'Other activity') { showToast('Type what you did first'); return; }
  if (duration < 1) { showToast('Enter a duration'); return; }

  const burn = calcBurn(baseMet, intensityMult, duration, weightLbs);
  const entry = { name: displayName, duration, intensityLabel, burn, time: new Date().toISOString() };
  getToday().exercise.push(entry);
  saveDays();
  updateDailyTotals();
  renderExerciseFeed();
  showToast(`🔥 ${burn} cal burned logged!`);

  if (name === 'Other') rememberCustomActivity(displayName, baseMet);
}

// Custom "Other" activities you actually use become permanent quick-select
// tiles so you don't have to retype them every time.
function rememberCustomActivity(name, baseMet) {
  if (!state.settings.customActivities) state.settings.customActivities = [];
  const exists = state.settings.customActivities.some(a => a.name.toLowerCase() === name.toLowerCase());
  if (!exists) {
    state.settings.customActivities.unshift({ name, baseMet });
    state.settings.customActivities = state.settings.customActivities.slice(0, 6);
    saveSettings();
    renderCustomActivities();
  }
}

function renderCustomActivities() {
  const grid = document.getElementById('activity-grid');
  if (!grid) return;
  grid.querySelectorAll('.custom-activity-btn').forEach(el => el.remove());
  const customActivities = state.settings.customActivities || [];
  if (!customActivities.length) return;
  const otherBtn = grid.querySelector('.activity-btn:last-child');
  customActivities.forEach(a => {
    const btn = document.createElement('div');
    btn.className = 'activity-btn custom-activity-btn';
    btn.innerHTML = `<div class="activity-icon">⭐</div>${a.name}`;
    btn.onclick = () => selectActivity(btn, a.name, a.baseMet);
    grid.insertBefore(btn, otherBtn);
  });
}

function renderExerciseFeed() {
  const feed = document.getElementById('exercise-feed');
  const title = document.getElementById('exercise-section-title');
  const exercise = getToday().exercise;
  if (exercise.length > 0) title.style.display = 'block';
  feed.innerHTML = exercise.slice().reverse().map(e => {
    const timeStr = new Date(e.time).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    return `<div class="exercise-log-item">
      <div class="exercise-icon-box">🔥</div>
      <div class="exercise-info">
        <div class="exercise-name">${e.name}</div>
        <div class="exercise-detail">${e.duration} min · ${e.intensityLabel}</div>
      </div>
      <div>
        <div class="exercise-burn">−${e.burn} cal</div>
        <div style="font-size:11px; color:var(--text2); text-align:right;">${timeStr}</div>
      </div>
    </div>`;
  }).join('');
}

// ─── Photo upload ──────────────────────────────────────────────
function triggerUpload(idx) { document.getElementById('file-input-' + idx).click(); }
function handleFile(idx, input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    state.photos[idx] = { file, dataUrl: e.target.result };
    const slot = document.getElementById('slot-' + idx);
    slot.classList.add('has-image');
    slot.innerHTML = `<img src="${e.target.result}" /><button class="remove-btn" onclick="removePhoto(event,${idx})">✕</button>`;
  };
  reader.readAsDataURL(file);
}
function removePhoto(e, idx) {
  e.stopPropagation();
  state.photos[idx] = null;
  const slot = document.getElementById('slot-' + idx);
  slot.classList.remove('has-image');
  slot.innerHTML = `<div class="plus-icon">+</div><div class="slot-label">Photo ${idx+1}</div>`;
  slot.onclick = () => triggerUpload(idx);
  document.getElementById('file-input-' + idx).value = '';
}

// ─── Photo analysis ────────────────────────────────────────────
async function analyzePhotos() {
  if (!state.photos.some(p => p !== null)) { showToast('Add at least one photo first'); return; }
  document.getElementById('loading-card').classList.add('visible');
  document.getElementById('result-card').classList.remove('visible');
  document.getElementById('analyze-btn').disabled = true;
  const note = document.getElementById('meal-note').value.trim();
  const images = state.photos.filter(p => p !== null).map(p => p.dataUrl);
  try {
    const result = await callClaudeVision(images, note);
    showResult(result);
  } catch(err) {
    showToast('Analysis failed — check your API key in Settings'); console.error(err);
  } finally {
    document.getElementById('loading-card').classList.remove('visible');
    document.getElementById('analyze-btn').disabled = false;
  }
}

function showResult(data) {
  document.getElementById('result-title').textContent = data.meal_name;
  document.getElementById('result-desc').textContent = data.description;
  document.getElementById('result-ingredients').textContent = '🔍 Detected: ' + data.ingredients_detected;
  document.getElementById('result-confidence').textContent = `~${data.confidence}% confidence`;
  document.getElementById('r-cal').textContent = data.calories;
  document.getElementById('r-pro').textContent = data.protein_g + 'g';
  document.getElementById('r-carb').textContent = data.carbs_g + 'g';
  document.getElementById('r-fat').textContent = data.fat_g + 'g';
  state._pendingLog = { data, thumb: state.photos.find(p => p)?.dataUrl || null };
  document.getElementById('result-card').classList.add('visible');
  document.getElementById('result-card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function logMeal() {
  if (!state._pendingLog) return;
  addToLog(state._pendingLog.data.meal_name, state._pendingLog.data.calories, state._pendingLog.data.protein_g, state._pendingLog.data.carbs_g, state._pendingLog.data.fat_g, state._pendingLog.thumb, '📸');
  [0,1,2].forEach(i => { if (state.photos[i]) removePhoto({ stopPropagation:()=>{} }, i); });
  document.getElementById('meal-note').value = '';
  document.getElementById('result-card').classList.remove('visible');
  state._pendingLog = null;
  showToast('Logged! ✓');
}

// ─── Manual / Search log ────────────────────────────────────────
async function searchFood() {
  const q = document.getElementById('search-input').value.trim().toLowerCase();
  if (!q) return;

  const recipeMatches = state.recipes
    .filter(r => r.name.toLowerCase().includes(q))
    .map(r => ({ name: r.name, cal: r.calories, pro: r.protein, carb: r.carbs, fat: r.fat, emoji: '📖' }));
  const dbMatches = FOOD_DB.filter(f => f.name.toLowerCase().includes(q));
  let combined = [...recipeMatches, ...dbMatches];

  const container = document.getElementById('search-results');
  const usdaKey = state.settings.usdaApiKey;

  if (usdaKey) {
    container.innerHTML = `<div style="font-size:13px; color:var(--text2); padding:10px 0;">Searching USDA food database...</div>`;
    try {
      const usdaResults = await searchUSDA(q, usdaKey);
      combined = [...combined.slice(0, 3), ...usdaResults];
    } catch (err) {
      showToast('USDA lookup failed — showing local matches only');
      console.error(err);
    }
  }

  combined = combined.slice(0, 8);

  if (combined.length === 0) {
    container.innerHTML = `<div style="font-size:13px; color:var(--text2); padding:10px 0;">No matches — enter it manually below.</div>`;
    return;
  }
  container.innerHTML = combined.map((f, i) => `
    <div class="search-result-item" onclick="selectSearchResult(${i})">
      <div>
        <div class="sri-name">${f.emoji} ${f.name}</div>
        <div class="sri-macros">${f.cal} cal · ${f.pro}g protein · ${f.carb}g carbs · ${f.fat}g fat${f.servingLabel ? ' · ' + f.servingLabel : ''}</div>
      </div>
      <div class="sri-add">+</div>
    </div>`).join('');
  container.dataset.results = JSON.stringify(combined);
}

function selectSearchResult(idx) {
  const results = JSON.parse(document.getElementById('search-results').dataset.results || '[]');
  const f = results[idx];
  if (!f) return;
  addToLog(f.name, f.cal, f.pro, f.carb, f.fat, null, f.emoji);
  document.getElementById('search-input').value = '';
  document.getElementById('search-results').innerHTML = '';
  showToast('Logged! ✓');
}

function logManual() {
  const name = document.getElementById('manual-name').value.trim();
  const cal = parseInt(document.getElementById('manual-cal').value) || 0;
  const pro = parseInt(document.getElementById('manual-pro').value) || 0;
  const carb = parseInt(document.getElementById('manual-carb').value) || 0;
  const fat = parseInt(document.getElementById('manual-fat').value) || 0;
  if (!name) { showToast('Enter a meal name first'); return; }
  addToLog(name, cal, pro, carb, fat, null, '✏️');
  ['manual-name','manual-serving','manual-cal','manual-pro','manual-carb','manual-fat'].forEach(id => document.getElementById(id).value = '');
  showToast('Logged! ✓');
}

function addToLog(name, cal, pro, carb, fat, thumb, emoji) {
  getToday().log.push({ name, cal, pro, carb, fat, thumb, emoji, time: new Date().toISOString() });
  saveDays();
  updateDailyTotals();
  renderLogFeed();
  renderQuickAdd();
}

function updateDailyTotals() {
  const log = getToday().log;
  const exercise = getToday().exercise;
  const t = log.reduce((a, i) => ({ cal: a.cal+i.cal, pro: a.pro+i.pro, carb: a.carb+i.carb, fat: a.fat+i.fat }), { cal:0, pro:0, carb:0, fat:0 });
  const totalBurned = exercise.reduce((a, e) => a + e.burn, 0);
  const goals = state.settings.goals;
  const adjustedGoal = goals.cal + totalBurned;
  const remaining = adjustedGoal - t.cal;

  document.getElementById('today-cal').textContent = t.cal;
  document.getElementById('today-pro').textContent = t.pro + 'g';
  document.getElementById('today-carb').textContent = t.carb + 'g';
  document.getElementById('today-fat').textContent = t.fat + 'g';

  const exRow = document.getElementById('exercise-summary-row');
  if (totalBurned > 0) {
    exRow.style.display = 'flex';
    document.getElementById('today-burned').textContent = totalBurned.toLocaleString();
    document.getElementById('today-budget').textContent = adjustedGoal.toLocaleString();
  } else {
    exRow.style.display = 'none';
  }

  const pct = Math.min(100, Math.round(t.cal / adjustedGoal * 100));
  document.getElementById('goal-bar-fill').style.width = pct + '%';
  const remainingStr = remaining >= 0 ? `${remaining.toLocaleString()} remaining` : `${Math.abs(remaining).toLocaleString()} over`;
  document.getElementById('goal-pct').textContent = `${t.cal.toLocaleString()} / ${adjustedGoal.toLocaleString()} kcal`;
  document.getElementById('goal-bar-label-left').textContent = totalBurned > 0 ? `${remainingStr}` : 'Calorie goal';

  updateStreakDisplay();
}

function updateStreakDisplay() {
  const streak = computeStreak();
  const el = document.getElementById('streak');
  if (streak > 0) {
    el.textContent = `🔥 ${streak}-day streak`;
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

let _todayLogFeedItems = [];

function renderLogFeed() {
  const feed = document.getElementById('log-feed');
  const title = document.getElementById('log-section-title');
  const log = getToday().log;
  if (log.length > 0) title.style.display = 'block';
  _todayLogFeedItems = log.slice().reverse();
  feed.innerHTML = _todayLogFeedItems.map((item, idx) => {
    const timeStr = new Date(item.time).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    const thumb = item.thumb ? `<img src="${item.thumb}" />` : item.emoji;
    const fav = isFavorite(item.name);
    return `<div class="log-item">
      <div class="log-thumb">${thumb}</div>
      <div class="log-info"><div class="log-name">${item.name}</div><div class="log-cals">${item.cal} kcal · ${item.pro}g protein · ${item.carb}g carbs · ${item.fat}g fat</div></div>
      <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
        <span class="fav-star ${fav ? 'active' : ''}" onclick="toggleFavoriteFromLogFeed(${idx})">${fav ? '★' : '☆'}</span>
        <div class="log-time">${timeStr}</div>
      </div>
    </div>`;
  }).join('');
}

// ─── Favorites & Recents ────────────────────────────────────────
let _quickAddFavorites = [];
let _quickAddRecents = [];

function getRecentFoods(limit) {
  const seen = new Map();
  const keys = Object.keys(state.days).sort((a, b) => b.localeCompare(a)).slice(0, 21);
  outer:
  for (const key of keys) {
    const day = state.days[key];
    for (let i = day.log.length - 1; i >= 0; i--) {
      const item = day.log[i];
      if (!seen.has(item.name)) {
        seen.set(item.name, { name: item.name, cal: item.cal, pro: item.pro, carb: item.carb, fat: item.fat, emoji: item.emoji || '🍽️' });
        if (seen.size >= limit) break outer;
      }
    }
  }
  return Array.from(seen.values());
}

function isFavorite(name) {
  return (state.settings.favorites || []).some(f => f.name === name);
}

function toggleFavoriteByItem(item) {
  if (!state.settings.favorites) state.settings.favorites = [];
  const idx = state.settings.favorites.findIndex(f => f.name === item.name);
  if (idx >= 0) {
    state.settings.favorites.splice(idx, 1);
    showToast('Removed from favorites');
  } else {
    state.settings.favorites.push({ ...item });
    showToast('Added to favorites ★');
  }
  saveSettings();
  renderQuickAdd();
  renderLogFeed();
}

function toggleFavoriteFromFavList(idx) { toggleFavoriteByItem(_quickAddFavorites[idx]); }
function toggleFavoriteFromRecentList(idx) { toggleFavoriteByItem(_quickAddRecents[idx]); }
function toggleFavoriteFromLogFeed(idx) {
  const item = _todayLogFeedItems[idx];
  if (item) toggleFavoriteByItem({ name: item.name, cal: item.cal, pro: item.pro, carb: item.carb, fat: item.fat, emoji: item.emoji || '🍽️' });
}

function quickAddLogFav(idx) { const f = _quickAddFavorites[idx]; if (f) { addToLog(f.name, f.cal, f.pro, f.carb, f.fat, null, f.emoji); showToast('Logged! ✓'); } }
function quickAddLogRecent(idx) { const f = _quickAddRecents[idx]; if (f) { addToLog(f.name, f.cal, f.pro, f.carb, f.fat, null, f.emoji); showToast('Logged! ✓'); } }

function quickAddChipHtml(f, isFav, logFn, starFn, idx) {
  return `<div class="search-result-item">
    <div onclick="${logFn}(${idx})" style="flex:1; cursor:pointer;">
      <div class="sri-name">${f.emoji} ${f.name}</div>
      <div class="sri-macros">${f.cal} cal · ${f.pro}g protein · ${f.carb}g carbs · ${f.fat}g fat</div>
    </div>
    <div style="display:flex; align-items:center; gap:10px;">
      <span class="fav-star ${isFav ? 'active' : ''}" onclick="${starFn}(${idx})">${isFav ? '★' : '☆'}</span>
      <span class="sri-add" onclick="${logFn}(${idx})">+</span>
    </div>
  </div>`;
}

function renderQuickAdd() {
  const favWrap = document.getElementById('favorites-wrap');
  if (!favWrap) return;
  const favList = document.getElementById('favorites-list');
  const recentWrap = document.getElementById('recent-wrap');
  const recentList = document.getElementById('recent-list');

  _quickAddFavorites = state.settings.favorites || [];
  if (_quickAddFavorites.length) {
    favWrap.style.display = 'block';
    favList.innerHTML = _quickAddFavorites.map((f, i) => quickAddChipHtml(f, true, 'quickAddLogFav', 'toggleFavoriteFromFavList', i)).join('');
  } else {
    favWrap.style.display = 'none';
  }

  _quickAddRecents = getRecentFoods(8).filter(r => !isFavorite(r.name));
  if (_quickAddRecents.length) {
    recentWrap.style.display = 'block';
    recentList.innerHTML = _quickAddRecents.map((f, i) => quickAddChipHtml(f, false, 'quickAddLogRecent', 'toggleFavoriteFromRecentList', i)).join('');
  } else {
    recentWrap.style.display = 'none';
  }
}
