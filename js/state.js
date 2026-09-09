// ─── Date utils ────────────────────────────────────────────────
function keyForDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayKey() {
  return keyForDate(new Date());
}

function shiftKey(key, deltaDays) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + deltaDays);
  return keyForDate(date);
}

// ─── State ─────────────────────────────────────────────────────
const DEFAULT_GOALS = { cal: 1850, pro: 150, carb: 180, fat: 55 };

function loadSettings() {
  const saved = JSON.parse(localStorage.getItem('fuel_settings') || 'null');
  const defaults = {
    apiKey: '',
    usdaApiKey: '',
    units: 'lbs',
    profile: { age: null, sex: 'male', height: null, activityLevel: 'moderate' },
    preferences: '',
    goals: { ...DEFAULT_GOALS },
    goalType: 'lose',
    userWeight: { start: null, goal: null },
    favorites: [],
    customActivities: [],
  };
  if (!saved) return defaults;
  return {
    ...defaults,
    ...saved,
    profile: { ...defaults.profile, ...(saved.profile || {}) },
    goals: { ...defaults.goals, ...(saved.goals || {}) },
    userWeight: { ...defaults.userWeight, ...(saved.userWeight || {}) },
  };
}

function loadGroceryList() {
  const saved = JSON.parse(localStorage.getItem('fuel_grocery') || 'null') || {};
  return { meals: saved.meals || [], checked: saved.checked || {} };
}

const state = {
  photos: [null, null, null],
  days: JSON.parse(localStorage.getItem('fuel_days') || '{}'),
  recipes: JSON.parse(localStorage.getItem('fuel_recipes') || '[]'),
  weights: JSON.parse(localStorage.getItem('fuel_weights') || '[]'),
  settings: loadSettings(),
  meals: [],
  mealsFilter: 'all',
  groceryListMeals: loadGroceryList().meals,
  groceryChecked: loadGroceryList().checked,
  _pendingLog: null,
  _exercise: { name: null, baseMet: null, intensityMult: 1.0, intensityLabel: 'Moderate' },
};

function saveDays() { localStorage.setItem('fuel_days', JSON.stringify(state.days)); }
function saveRecipes() { localStorage.setItem('fuel_recipes', JSON.stringify(state.recipes)); }
function saveWeights() { localStorage.setItem('fuel_weights', JSON.stringify(state.weights)); }
function saveSettings() { localStorage.setItem('fuel_settings', JSON.stringify(state.settings)); }
function saveGroceryList() { localStorage.setItem('fuel_grocery', JSON.stringify({ meals: state.groceryListMeals, checked: state.groceryChecked })); }

function ensureDay(key) {
  if (!state.days[key]) state.days[key] = { log: [], exercise: [] };
  return state.days[key];
}

function getToday() {
  return ensureDay(todayKey());
}

// Consecutive days (walking back from today) with at least one log or exercise entry.
// Today doesn't break the streak if it's simply empty so far.
function computeStreak() {
  let streak = 0;
  let key = todayKey();
  const today = state.days[key];
  const todayIsEmpty = !today || (today.log.length === 0 && today.exercise.length === 0);
  if (todayIsEmpty) key = shiftKey(key, -1);
  while (true) {
    const day = state.days[key];
    if (!day || (day.log.length === 0 && day.exercise.length === 0)) break;
    streak++;
    key = shiftKey(key, -1);
  }
  return streak;
}
