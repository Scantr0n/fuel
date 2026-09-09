const ACTIVITY_MULTIPLIERS = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };

function renderSettings() {
  document.getElementById('settings-api-key').value = state.settings.apiKey;
  document.getElementById('settings-usda-key').value = state.settings.usdaApiKey || '';
  document.getElementById('settings-preferences').value = state.settings.preferences || '';
  document.getElementById('profile-age').value = state.settings.profile.age || '';
  document.getElementById('profile-sex').value = state.settings.profile.sex || 'male';
  document.getElementById('profile-height').value = state.settings.profile.height || '';
  document.getElementById('profile-activity').value = state.settings.profile.activityLevel || 'moderate';
  document.getElementById('unit-lbs').classList.toggle('active', state.settings.units === 'lbs');
  document.getElementById('unit-kg').classList.toggle('active', state.settings.units === 'kg');
  document.getElementById('profile-height-label').textContent = state.settings.units === 'kg' ? 'Height (cm)' : 'Height (inches)';
  document.getElementById('connection-status').className = 'connection-status';
  document.getElementById('usda-connection-status').className = 'connection-status';

  const keyInput = document.getElementById('settings-api-key');
  const saveBtn = document.getElementById('save-api-key-btn');
  const descEl = document.getElementById('api-key-desc');
  if (isLocalDev()) {
    keyInput.disabled = false;
    saveBtn.disabled = false;
    descEl.textContent = 'Needed for real photo analysis and AI meal ideas. Without one, the app runs in demo mode with sample data. Your key is stored only in this browser.';
  } else {
    keyInput.disabled = true;
    saveBtn.disabled = true;
    descEl.textContent = 'This deployment uses a server-side key configured in Netlify — you don\'t need to enter one here, and nothing you type in this field is sent anywhere. Use Test Connection to confirm the server is set up.';
  }
}

function saveApiKey() {
  const key = document.getElementById('settings-api-key').value.trim();
  state.settings.apiKey = key;
  saveSettings();
  showToast(key ? 'API key saved ✓' : 'API key cleared — running in demo mode');
}

async function testConnection() {
  const statusEl = document.getElementById('connection-status');
  statusEl.className = 'connection-status show testing';
  statusEl.textContent = 'Testing connection...';
  try {
    if (isLocalDev()) {
      const key = document.getElementById('settings-api-key').value.trim();
      if (!key) { showToast('Enter an API key first'); statusEl.className = 'connection-status'; return; }
      await testApiKey(key);
      state.settings.apiKey = key;
      saveSettings();
    } else {
      await testClaudeProxy();
    }
    statusEl.className = 'connection-status show ok';
    statusEl.textContent = '✓ Connected — your key works.';
  } catch (err) {
    statusEl.className = 'connection-status show fail';
    statusEl.textContent = `✕ ${err.message || 'Could not connect. Check your key.'}`;
  }
}

function saveUsdaKey() {
  const key = document.getElementById('settings-usda-key').value.trim();
  state.settings.usdaApiKey = key;
  saveSettings();
  showToast(key ? 'USDA key saved ✓' : 'USDA key cleared');
}

async function testUsdaConnection() {
  const key = document.getElementById('settings-usda-key').value.trim();
  const statusEl = document.getElementById('usda-connection-status');
  if (!key) { showToast('Enter a USDA API key first'); return; }
  statusEl.className = 'connection-status show testing';
  statusEl.textContent = 'Testing connection...';
  try {
    const results = await searchUSDA('apple', key);
    state.settings.usdaApiKey = key;
    saveSettings();
    statusEl.className = 'connection-status show ok';
    statusEl.textContent = `✓ Connected — found ${results.length} results for "apple".`;
  } catch (err) {
    statusEl.className = 'connection-status show fail';
    statusEl.textContent = `✕ ${err.message || 'Could not connect. Check your key.'}`;
  }
}

function setUnits(unit, btn) {
  state.settings.units = unit;
  saveSettings();
  document.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('profile-height-label').textContent = unit === 'kg' ? 'Height (cm)' : 'Height (inches)';
  updateBurnPreview();
  renderProgress();
}

function updatePreferences() {
  state.settings.preferences = document.getElementById('settings-preferences').value;
  saveSettings();
}

function calculateTDEEAndSetGoals() {
  const age = parseInt(document.getElementById('profile-age').value) || null;
  const sex = document.getElementById('profile-sex').value;
  const heightVal = parseFloat(document.getElementById('profile-height').value) || null;
  const activity = document.getElementById('profile-activity').value;
  const currentWeight = state.settings.userWeight.start;

  if (!age || !heightVal || !currentWeight) {
    showToast('Add your age, height here, and current weight (Progress tab) first');
    return;
  }

  state.settings.profile = { age, sex, height: heightVal, activityLevel: activity };
  saveSettings();

  const weightLbs = state.settings.units === 'kg' ? currentWeight * 2.20462 : currentWeight;
  const weightKg = state.settings.units === 'kg' ? currentWeight : currentWeight * 0.453592;
  const heightCm = state.settings.units === 'kg' ? heightVal : heightVal * 2.54;

  let bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'female' ? -161 : 5);
  const tdee = bmr * (ACTIVITY_MULTIPLIERS[activity] || 1.55);

  let targetCal = tdee;
  if (state.settings.goalType === 'lose') targetCal = tdee - 500;

  const protein = Math.round(weightLbs * 1.0);
  const proteinCals = protein * 4;
  const fatCals = targetCal * 0.25;
  const fat = Math.round(fatCals / 9);
  const carbs = Math.max(0, Math.round((targetCal - proteinCals - fatCals) / 4));

  state.settings.goals = { cal: Math.round(targetCal), pro: protein, carb: carbs, fat };
  saveSettings();

  document.getElementById('target-cal').value = state.settings.goals.cal;
  document.getElementById('target-pro').value = state.settings.goals.pro;
  document.getElementById('target-carb').value = state.settings.goals.carb;
  document.getElementById('target-fat').value = state.settings.goals.fat;
  document.getElementById('recap-cal').textContent = state.settings.goals.cal.toLocaleString() + ' kcal';
  document.getElementById('recap-pro').textContent = state.settings.goals.pro + 'g';
  document.getElementById('recap-carb').textContent = state.settings.goals.carb + 'g';
  document.getElementById('recap-fat').textContent = state.settings.goals.fat + 'g';

  updateDailyTotals();
  showToast(`Goals calculated: ${Math.round(targetCal)} cal, ${protein}g protein`);
}

// ─── Backup / export ────────────────────────────────────────────
function exportData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    days: state.days,
    recipes: state.recipes,
    weights: state.weights,
    settings: { ...state.settings, apiKey: undefined, usdaApiKey: undefined },
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fuel-backup-${todayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Backup downloaded ✓');
}

// ─── Backup / restore ───────────────────────────────────────────
// Merge only — anything already on this device is never overwritten,
// only filled in with entries the backup has that this device doesn't.
function mergeBackup(backup) {
  let daysAdded = 0, recipesAdded = 0, weightsAdded = 0;

  if (backup.days && typeof backup.days === 'object') {
    for (const [key, day] of Object.entries(backup.days)) {
      if (!state.days[key]) {
        state.days[key] = day;
        daysAdded++;
      }
    }
    saveDays();
  }

  if (Array.isArray(backup.recipes)) {
    const existingIds = new Set(state.recipes.map(r => r.id));
    for (const r of backup.recipes) {
      if (!existingIds.has(r.id)) {
        state.recipes.push(r);
        existingIds.add(r.id);
        recipesAdded++;
      }
    }
    saveRecipes();
  }

  if (Array.isArray(backup.weights)) {
    const existingKeys = new Set(state.weights.map(w => `${w.date}|${w.weight}`));
    for (const w of backup.weights) {
      const key = `${w.date}|${w.weight}`;
      if (!existingKeys.has(key)) {
        state.weights.push(w);
        existingKeys.add(key);
        weightsAdded++;
      }
    }
    state.weights.sort((a, b) => new Date(a.date) - new Date(b.date));
    saveWeights();
  }

  if (backup.settings && typeof backup.settings === 'object') {
    const bs = backup.settings;
    state.settings = {
      ...state.settings,
      ...bs,
      apiKey: state.settings.apiKey,
      usdaApiKey: state.settings.usdaApiKey,
      profile: { ...state.settings.profile, ...(bs.profile || {}) },
      goals: { ...state.settings.goals, ...(bs.goals || {}) },
      userWeight: { ...state.settings.userWeight, ...(bs.userWeight || {}) },
      favorites: Array.isArray(bs.favorites) ? bs.favorites : state.settings.favorites,
    };
    saveSettings();
  }

  return { daysAdded, recipesAdded, weightsAdded };
}

function triggerRestore() {
  document.getElementById('restore-file-input').click();
}

function handleRestoreFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    let backup;
    try {
      backup = JSON.parse(e.target.result);
    } catch (err) {
      showToast("That file isn't valid JSON");
      input.value = '';
      return;
    }
    if (!backup || typeof backup !== 'object' || (!backup.days && !backup.recipes && !backup.weights && !backup.settings)) {
      showToast("That doesn't look like a Fuel backup file");
      input.value = '';
      return;
    }

    const { daysAdded, recipesAdded, weightsAdded } = mergeBackup(backup);
    input.value = '';

    renderLogFeed();
    renderExerciseFeed();
    renderQuickAdd();
    updateDailyTotals();
    renderProgress();
    renderRecipes();
    renderSettings();

    const weightLabel = weightsAdded === 1 ? 'entry' : 'entries';
    showToast(`Restored ✓ ${daysAdded} day(s), ${recipesAdded} recipe(s), ${weightsAdded} weight ${weightLabel}`);
  };
  reader.readAsText(file);
}
