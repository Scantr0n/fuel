function setGoalType(type, btn) {
  state.settings.goalType = type;
  saveSettings();
  document.querySelectorAll('.goal-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('goal-weight-field').style.display = type === 'lose' ? 'block' : 'none';
  document.getElementById('weight-stats').style.display = type === 'track' ? 'none' : 'grid';
  document.getElementById('progress-bar-card').style.display = type === 'lose' ? 'block' : 'none';
  renderProgress();
}

function updateGoals() {
  const g = state.settings.goals;
  g.cal = parseInt(document.getElementById('target-cal').value) || 1850;
  g.pro = parseInt(document.getElementById('target-pro').value) || 150;
  g.carb = parseInt(document.getElementById('target-carb').value) || 180;
  g.fat = parseInt(document.getElementById('target-fat').value) || 55;
  state.settings.userWeight.start = parseFloat(document.getElementById('setup-current').value) || null;
  state.settings.userWeight.goal = parseFloat(document.getElementById('setup-goal').value) || null;
  saveSettings();
  document.getElementById('recap-cal').textContent = g.cal.toLocaleString() + ' kcal';
  document.getElementById('recap-pro').textContent = g.pro + 'g';
  document.getElementById('recap-carb').textContent = g.carb + 'g';
  document.getElementById('recap-fat').textContent = g.fat + 'g';
  updateDailyTotals();
  renderProgress();
}

function logWeight() {
  const val = parseFloat(document.getElementById('weight-entry').value);
  if (isNaN(val) || val < 20 || val > 500) { showToast('Enter a valid weight'); return; }
  state.weights.push({ weight: val, date: new Date().toISOString() });
  saveWeights();
  document.getElementById('weight-entry').value = '';
  renderProgress();
  showToast(`Logged ${val} ${state.settings.units} ✓`);
}

function weightUnitLabel() {
  return state.settings.units === 'kg' ? 'kg' : 'lbs';
}

function renderProgress() {
  const unit = weightUnitLabel();
  document.querySelectorAll('.weight-unit-label').forEach(el => el.textContent = unit);

  const start = state.settings.userWeight.start || (state.weights.length ? state.weights[0].weight : null);
  const goalW = state.settings.userWeight.goal;
  const current = state.weights.length ? state.weights[state.weights.length - 1].weight : start;

  if (current) document.getElementById('stat-current').textContent = current;
  document.getElementById('stat-goal-display').textContent = goalW || '—';

  if (start && current) {
    const lost = Math.max(0, +(start - current).toFixed(1));
    document.getElementById('stat-lost').textContent = lost;
    if (goalW) {
      const toGo = Math.max(0, +(current - goalW).toFixed(1));
      document.getElementById('stat-to-go').textContent = toGo;
      const totalNeeded = start - goalW;
      const pct = totalNeeded > 0 ? Math.min(100, Math.round(lost / totalNeeded * 100)) : 100;
      document.getElementById('progress-pct').textContent = pct + '%';
      document.getElementById('progress-bar').style.width = pct + '%';
      document.getElementById('progress-note').textContent = toGo > 0 ? `${toGo} ${unit} to go toward your ${goalW} ${unit} goal` : '🎉 Goal reached!';
    }
  }
  renderWeightChart();
  renderWeeklySummary();
  renderHistory();
}

// ─── Weekly summary ──────────────────────────────────────────────
function renderWeeklySummary() {
  const el = document.getElementById('weekly-summary');
  if (!el) return;

  const keys = Object.keys(state.days)
    .filter(k => state.days[k].log.length > 0)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 7);

  if (!keys.length) {
    el.innerHTML = '<div class="empty-state" style="padding:16px 0;"><p>Log a few days to see your weekly summary here.</p></div>';
    return;
  }

  let totalCal = 0, totalPro = 0, daysAtGoal = 0;
  keys.forEach(key => {
    const day = state.days[key];
    const totals = day.log.reduce((a, i) => ({ cal: a.cal + i.cal, pro: a.pro + i.pro }), { cal: 0, pro: 0 });
    const burned = day.exercise.reduce((a, e) => a + e.burn, 0);
    totalCal += totals.cal;
    totalPro += totals.pro;
    if (totals.cal <= state.settings.goals.cal + burned) daysAtGoal++;
  });

  const avgCal = Math.round(totalCal / keys.length);
  const avgPro = Math.round(totalPro / keys.length);

  el.innerHTML = `
    <div class="stat-row">
      <div class="stat-box"><div class="sv">${avgCal.toLocaleString()}</div><div class="sl">Avg cal/day (${keys.length}d)</div></div>
      <div class="stat-box"><div class="sv" style="color:var(--blue)">${avgPro}g</div><div class="sl">Avg protein/day</div></div>
      <div class="stat-box"><div class="sv" style="color:var(--accent)">${daysAtGoal}/${keys.length}</div><div class="sl">Days at/under goal</div></div>
    </div>`;
}

function renderWeightChart() {
  const area = document.getElementById('weight-chart-area');
  if (state.weights.length < 2) {
    area.innerHTML = '<div class="empty-state" style="flex:1; padding:10px 0;"><p>Log at least 2 entries to see your chart here.</p></div>';
    return;
  }
  const last14 = state.weights.slice(-14);
  const vals = last14.map(w => w.weight);
  const min = Math.min(...vals) - 2, max = Math.max(...vals) + 2, range = max - min || 1;
  area.innerHTML = last14.map(w => {
    const d = new Date(w.date);
    const label = (d.getMonth()+1) + '/' + d.getDate();
    const heightPct = ((w.weight - min) / range * 80) + 10;
    return `<div class="chart-bar-wrap"><div class="chart-val">${w.weight}</div><div class="chart-bar-outer" style="height:90px"><div class="chart-bar-inner" style="height:${heightPct}%"></div></div><div class="chart-label">${label}</div></div>`;
  }).join('');
}

// ─── History ───────────────────────────────────────────────────
function formatHistoryDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === keyForDate(yesterday)) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function renderHistory() {
  const list = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');
  const todayK = todayKey();
  const pastKeys = Object.keys(state.days)
    .filter(k => k !== todayK && (state.days[k].log.length > 0 || state.days[k].exercise.length > 0))
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 30);

  if (!pastKeys.length) { list.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  list.innerHTML = pastKeys.map((key, idx) => {
    const day = state.days[key];
    const totals = day.log.reduce((a, i) => ({ cal: a.cal+i.cal, pro: a.pro+i.pro, carb: a.carb+i.carb, fat: a.fat+i.fat }), { cal:0, pro:0, carb:0, fat:0 });
    const burned = day.exercise.reduce((a, e) => a + e.burn, 0);
    const goalCal = state.settings.goals.cal + burned;
    const hitGoal = totals.cal <= goalCal;

    const foodHtml = day.log.length
      ? day.log.map(item => `<div class="recipe-ingredient">${item.emoji || '🍽️'} ${item.name} — ${item.cal} cal, ${item.pro}g protein</div>`).join('')
      : '<div class="recipe-ingredient">No food logged that day.</div>';
    const exerciseHtml = day.exercise.length
      ? `<div class="history-exercise-label">Exercise</div>` + day.exercise.map(e => `<div class="recipe-ingredient">🔥 ${e.name} — ${e.duration} min, −${e.burn} cal</div>`).join('')
      : '';

    return `
      <div class="recipe-card">
        <div class="recipe-card-header" onclick="toggleHistoryDay(${idx}, this)">
          <div class="recipe-header-left">
            <div class="recipe-name">${formatHistoryDate(key)}</div>
            <div class="recipe-meta">
              <span>🔥 ${totals.cal} cal</span>
              <span>💪 ${totals.pro}g protein</span>
              <span class="history-badge ${hitGoal ? 'history-badge-good' : 'history-badge-over'}">${hitGoal ? '✓ Under goal' : '⚠ Over goal'}</span>
            </div>
          </div>
          <div class="recipe-chevron" id="chev-hist-${idx}">▾</div>
        </div>
        <div class="recipe-body" id="hist-${idx}">
          ${foodHtml}
          ${exerciseHtml}
        </div>
      </div>`;
  }).join('');
}

function toggleHistoryDay(idx, header) {
  const body = document.getElementById('hist-' + idx);
  const chevron = document.getElementById('chev-hist-' + idx);
  const isOpen = body.classList.toggle('open');
  if (chevron) chevron.classList.toggle('open', isOpen);
}
