async function generateMeals() {
  const pref = document.getElementById('meal-pref-input').value.trim();
  document.getElementById('gen-meals-btn').disabled = true;
  document.getElementById('meals-loading').classList.add('visible');
  document.getElementById('meals-empty').style.display = 'none';
  document.getElementById('meals-list').innerHTML = '';
  const apiKey = state.settings.apiKey;
  if (isLocalDev() && !apiKey) {
    await delay(1600);
    state.meals = DEMO_MEALS;
  } else {
    try { state.meals = await callClaudeMeals(pref, apiKey); }
    catch(e) { state.meals = DEMO_MEALS; showToast('Using demo meals — check your API key in Settings'); }
  }
  document.getElementById('meals-loading').classList.remove('visible');
  document.getElementById('gen-meals-btn').disabled = false;
  state.mealsFilter = 'all';
  document.querySelectorAll('.filter-chip').forEach((c,i) => c.classList.toggle('active', i===0));
  renderMeals();
}

function filterMeals(cat, chip) {
  state.mealsFilter = cat;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  renderMeals();
}

function renderMeals() {
  const list = document.getElementById('meals-list');
  const filtered = state.mealsFilter === 'all' ? state.meals : state.meals.filter(m => m.category === state.mealsFilter);
  if (!filtered.length) { list.innerHTML = '<div class="empty-state"><p>No meals in this category.</p></div>'; return; }
  list.innerHTML = filtered.map(m => {
    const catLabel = m.category.charAt(0).toUpperCase() + m.category.slice(1);
    const isSaved = state.recipes.some(r => r.id === m.id);
    const inGroceryList = isInGroceryList('meal-' + m.id);
    const groceryHtml = Object.entries(m.grocery || {}).map(([sec, items]) =>
      `<div class="grocery-section"><div class="grocery-section-title">${sec}</div><ul class="grocery-items">${items.map(i => `<li><div class="grocery-check" onclick="toggleCheck(this)"></div>${i}</li>`).join('')}</ul></div>`
    ).join('');
    const stepsHtml = (m.steps || []).map((s, i) => `<li><span class="step-num">${i+1}</span>${s}</li>`).join('');
    return `
      <div class="meal-card" id="meal-${m.id}">
        <div class="meal-card-top">
          <div class="meal-card-name">${m.name}</div>
          <div class="meal-category-badge badge-${m.category}">${catLabel}</div>
        </div>
        <div class="meal-card-desc">${m.desc}</div>
        <div class="meal-macros-row">
          <div class="meal-macro-chip mc"><div class="mv">${m.calories}</div><div class="ml">Cal</div></div>
          <div class="meal-macro-chip mp"><div class="mv">${m.protein}g</div><div class="ml">Protein</div></div>
          <div class="meal-macro-chip mca"><div class="mv">${m.carbs}g</div><div class="ml">Carbs</div></div>
          <div class="meal-macro-chip mf"><div class="mv">${m.fat}g</div><div class="ml">Fat</div></div>
        </div>
        <div class="meal-card-actions">
          <button class="meal-action-btn btn-log-meal" onclick="logFromMeal(${m.id})">＋ Log</button>
          <button class="meal-action-btn btn-grocery" id="gbtn-${m.id}" onclick="toggleExpandable('grocery-${m.id}','gbtn-${m.id}','🛒 Grocery','✕ Close')">🛒 Grocery</button>
          <button class="meal-action-btn btn-recipe" id="rbtn-${m.id}" onclick="toggleExpandable('steps-${m.id}','rbtn-${m.id}','📋 How To','✕ Close')">📋 How To</button>
          <button class="meal-action-btn btn-save-recipe ${isSaved?'saved':''}" id="save-btn-${m.id}" onclick="saveToRecipeBook(${m.id})">${isSaved?'✓ Saved':'+ Save'}</button>
          <button class="meal-action-btn btn-save-recipe ${inGroceryList?'saved':''}" onclick="toggleMealGroceryList(${m.id})">${inGroceryList?'✓ In List':'🛒 Add to List'}</button>
        </div>
        <div class="meal-expandable" id="grocery-${m.id}">
          <div class="yield-badge">🍳 ${m.yield || '1 serving'}</div>
          <div class="exp-title">🛒 Grocery List</div>
          ${groceryHtml}
        </div>
        <div class="meal-expandable" id="steps-${m.id}">
          <div class="yield-badge">🍳 ${m.yield || '1 serving'}</div>
          <div class="exp-title">📋 How to Make It</div>
          <ul class="recipe-steps-list">${stepsHtml}</ul>
        </div>
      </div>`;
  }).join('');
}

function saveToRecipeBook(id) {
  const meal = state.meals.find(m => m.id === id);
  if (!meal || state.recipes.some(r => r.id === id)) { showToast('Already saved'); return; }
  state.recipes.push({ ...meal, savedAt: new Date().toISOString() });
  saveRecipes();
  const btn = document.getElementById('save-btn-' + id);
  if (btn) { btn.textContent = '✓ Saved'; btn.classList.add('saved'); }
  showToast('Saved to Recipe Book! 📖');
}

function logFromMeal(id) {
  const meal = state.meals.find(m => m.id === id);
  if (!meal) return;
  addToLog(meal.name, meal.calories, meal.protein, meal.carbs, meal.fat, null, '🍽️');
  goToLogPage();
  showToast(`${meal.name} logged! ✓`);
}

// ─── Combined grocery list ───────────────────────────────────────
function isInGroceryList(key) {
  return state.groceryListMeals.some(m => m.key === key);
}

function toggleMealGroceryList(id) {
  const meal = state.meals.find(m => m.id === id);
  if (!meal) return;
  toggleGroceryListEntry('meal-' + id, meal.name, meal.grocery);
  renderMeals();
}

function toggleGroceryListEntry(key, name, grocery) {
  const idx = state.groceryListMeals.findIndex(m => m.key === key);
  if (idx >= 0) {
    state.groceryListMeals.splice(idx, 1);
    showToast('Removed from grocery list');
  } else {
    state.groceryListMeals.push({ key, name, grocery: grocery || {} });
    showToast('Added to grocery list 🛒');
  }
  saveGroceryList();
  renderGroceryList();
}

let _groceryFlatItems = [];

function renderGroceryList() {
  const wrap = document.getElementById('grocery-list-wrap');
  if (!wrap) return;
  if (!state.groceryListMeals.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';

  const categoryMap = {};
  state.groceryListMeals.forEach(m => {
    Object.entries(m.grocery || {}).forEach(([cat, items]) => {
      if (!categoryMap[cat]) categoryMap[cat] = new Map();
      items.forEach(item => {
        const key = item.trim();
        categoryMap[cat].set(key, (categoryMap[cat].get(key) || 0) + 1);
      });
    });
  });

  _groceryFlatItems = [];
  const sections = Object.entries(categoryMap).map(([cat, map]) => {
    const itemsHtml = Array.from(map.entries()).map(([item, count]) => {
      const idx = _groceryFlatItems.length;
      _groceryFlatItems.push(item);
      const checked = state.groceryChecked[item] ? 'checked' : '';
      const label = count > 1 ? `${item} (×${count})` : item;
      return `<li><div class="grocery-check ${checked}" onclick="toggleGroceryCheckIdx(${idx})">${checked ? '✓' : ''}</div>${label}</li>`;
    }).join('');
    return `<div class="grocery-section"><div class="grocery-section-title">${cat}</div><ul class="grocery-items">${itemsHtml}</ul></div>`;
  }).join('');

  const mealChipsHtml = state.groceryListMeals.map((m, i) =>
    `<span class="filter-chip active" style="cursor:default; display:inline-flex; align-items:center; gap:6px;">${m.name}<span style="cursor:pointer;" onclick="removeFromGroceryListIdx(${i})">✕</span></span>`
  ).join('');

  wrap.innerHTML = `
    <div class="goal-card-title">🛒 Combined list from:</div>
    <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:14px;">${mealChipsHtml}</div>
    ${sections}
    <button class="secondary-btn" style="margin-top:4px;" onclick="clearGroceryList()">Clear Grocery List</button>
  `;
}

function toggleGroceryCheckIdx(idx) {
  const item = _groceryFlatItems[idx];
  if (item === undefined) return;
  state.groceryChecked[item] = !state.groceryChecked[item];
  saveGroceryList();
  renderGroceryList();
}

function removeFromGroceryListIdx(idx) {
  state.groceryListMeals.splice(idx, 1);
  saveGroceryList();
  renderGroceryList();
  renderMeals();
  if (typeof renderRecipes === 'function') renderRecipes();
}

function clearGroceryList() {
  state.groceryListMeals = [];
  saveGroceryList();
  renderGroceryList();
  renderMeals();
  if (typeof renderRecipes === 'function') renderRecipes();
  showToast('Grocery list cleared');
}
