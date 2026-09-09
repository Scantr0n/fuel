let recipeFilter = 'all';

function filterRecipes(cat, tab) {
  recipeFilter = cat;
  document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  renderRecipes();
}

function renderRecipes() {
  const list = document.getElementById('recipe-list');
  const empty = document.getElementById('recipe-empty');
  const filtered = recipeFilter === 'all' ? state.recipes : state.recipes.filter(r => r.category === recipeFilter);
  if (!filtered.length) { list.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  list.innerHTML = filtered.map((r, idx) => {
    const catLabel = r.category.charAt(0).toUpperCase() + r.category.slice(1);
    const groceryHtml = Object.entries(r.grocery || {}).map(([sec, items]) =>
      `<div style="font-size:11px; font-weight:600; color:var(--accent2); margin-bottom:4px; margin-top:10px;">${sec}</div>${items.map(i => `<div class="recipe-ingredient">• ${i}</div>`).join('')}`
    ).join('');
    const stepsHtml = (r.steps || []).map((s, i) => `<div class="recipe-step"><span class="step-num">${i+1}</span>${s}</div>`).join('');
    const inGroceryList = isInGroceryList('recipe-' + r.id);
    return `
      <div class="recipe-card">
        <div class="recipe-card-header" onclick="toggleRecipe('rb-${idx}', this)">
          <div class="recipe-header-left">
            <div class="recipe-name">${r.name}</div>
            <div class="recipe-meta">
              <span><span class="meal-category-badge badge-${r.category}" style="padding:2px 6px; font-size:9px;">${catLabel}</span></span>
              <span>🔥 ${r.calories} cal</span>
              <span>💪 ${r.protein}g protein</span>
              <span>🍳 ${r.yield || '1 serving'}</span>
            </div>
          </div>
          <div class="recipe-chevron" id="chev-rb-${idx}">▾</div>
        </div>
        <div class="recipe-body" id="rb-${idx}">
          <div class="recipe-macros-row">
            <div class="recipe-macro-chip rmc"><div class="rmv">${r.calories}</div><div class="rml">Cal</div></div>
            <div class="recipe-macro-chip rmp"><div class="rmv">${r.protein}g</div><div class="rml">Protein</div></div>
            <div class="recipe-macro-chip rmca"><div class="rmv">${r.carbs}g</div><div class="rml">Carbs</div></div>
            <div class="recipe-macro-chip rmf"><div class="rmv">${r.fat}g</div><div class="rml">Fat</div></div>
          </div>
          <div class="recipe-section-label">📋 How to Make It</div>
          ${stepsHtml}
          <div class="recipe-section-label" style="margin-top:16px;">🛒 Grocery List</div>
          <div style="font-size:11px; color:var(--text2); margin-bottom:8px;">${r.yield || '1 serving'}</div>
          ${groceryHtml}
          <div style="display:flex; gap:8px; margin-top:16px; flex-wrap:wrap;">
            <button class="meal-action-btn btn-log-meal" style="flex:1; min-width:100px;" onclick="logFromRecipe(${idx})">＋ Log This Meal</button>
            <button class="meal-action-btn btn-grocery" style="flex:1; min-width:100px;" onclick="editRecipe('${r.id}')">✎ Edit</button>
            <button class="meal-action-btn btn-save-recipe ${inGroceryList?'saved':''}" style="flex:1; min-width:100px;" onclick="toggleRecipeGroceryList(${idx})">${inGroceryList?'✓ In List':'🛒 Add to List'}</button>
            <button class="meal-action-btn btn-unsave" style="flex:1; min-width:100px;" onclick="unsaveRecipe(${idx})">🗑 Remove</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

function toggleRecipe(bodyId, header) {
  const body = document.getElementById(bodyId);
  const chevron = document.getElementById('chev-' + bodyId);
  const isOpen = body.classList.toggle('open');
  if (chevron) chevron.classList.toggle('open', isOpen);
}

function logFromRecipe(idx) {
  const filtered = recipeFilter === 'all' ? state.recipes : state.recipes.filter(r => r.category === recipeFilter);
  const recipe = filtered[idx];
  if (!recipe) return;
  addToLog(recipe.name, recipe.calories, recipe.protein, recipe.carbs, recipe.fat, null, '📖');
  goToLogPage();
  showToast(`${recipe.name} logged! ✓`);
}

function unsaveRecipe(idx) {
  const filtered = recipeFilter === 'all' ? state.recipes : state.recipes.filter(r => r.category === recipeFilter);
  const recipe = filtered[idx];
  if (!recipe) return;
  state.recipes = state.recipes.filter(r => r.id !== recipe.id);
  saveRecipes();
  renderRecipes();
  showToast('Recipe removed');
}

function toggleRecipeGroceryList(idx) {
  const filtered = recipeFilter === 'all' ? state.recipes : state.recipes.filter(r => r.category === recipeFilter);
  const recipe = filtered[idx];
  if (!recipe) return;
  toggleGroceryListEntry('recipe-' + recipe.id, recipe.name, recipe.grocery);
  renderRecipes();
}

// ─── Create / edit recipe form ──────────────────────────────────
let _editingRecipeId = null;

function clearRecipeForm() {
  _editingRecipeId = null;
  document.getElementById('recipe-form-title').textContent = 'New Recipe';
  document.getElementById('rf-name').value = '';
  document.getElementById('rf-category').value = 'lunch';
  document.getElementById('rf-cal').value = '';
  document.getElementById('rf-pro').value = '';
  document.getElementById('rf-carb').value = '';
  document.getElementById('rf-fat').value = '';
  document.getElementById('rf-yield').value = '';
  document.getElementById('rf-ingredients').value = '';
  document.getElementById('rf-steps').value = '';
}

function toggleRecipeForm() {
  const card = document.getElementById('recipe-form-card');
  const isOpening = card.style.display === 'none';
  if (isOpening) {
    clearRecipeForm();
    card.style.display = 'block';
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    card.style.display = 'none';
    _editingRecipeId = null;
  }
}

function editRecipe(id) {
  const recipe = state.recipes.find(r => r.id == id);
  if (!recipe) return;
  _editingRecipeId = recipe.id;
  document.getElementById('recipe-form-title').textContent = 'Edit Recipe';
  document.getElementById('rf-name').value = recipe.name;
  document.getElementById('rf-category').value = recipe.category;
  document.getElementById('rf-cal').value = recipe.calories;
  document.getElementById('rf-pro').value = recipe.protein;
  document.getElementById('rf-carb').value = recipe.carbs;
  document.getElementById('rf-fat').value = recipe.fat;
  document.getElementById('rf-yield').value = recipe.yield || '';
  document.getElementById('rf-ingredients').value = Object.values(recipe.grocery || {}).flat().join('\n');
  document.getElementById('rf-steps').value = (recipe.steps || []).join('\n');
  const card = document.getElementById('recipe-form-card');
  card.style.display = 'block';
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function saveRecipeForm() {
  const name = document.getElementById('rf-name').value.trim();
  if (!name) { showToast('Give the recipe a name'); return; }

  const category = document.getElementById('rf-category').value;
  const calories = parseInt(document.getElementById('rf-cal').value) || 0;
  const protein = parseInt(document.getElementById('rf-pro').value) || 0;
  const carbs = parseInt(document.getElementById('rf-carb').value) || 0;
  const fat = parseInt(document.getElementById('rf-fat').value) || 0;
  const yieldVal = document.getElementById('rf-yield').value.trim();
  const ingredients = document.getElementById('rf-ingredients').value.split('\n').map(s => s.trim()).filter(Boolean);
  const steps = document.getElementById('rf-steps').value.split('\n').map(s => s.trim()).filter(Boolean);
  const grocery = ingredients.length ? { 'Ingredients': ingredients } : {};

  if (_editingRecipeId) {
    const recipe = state.recipes.find(r => r.id == _editingRecipeId);
    if (recipe) Object.assign(recipe, { name, category, calories, protein, carbs, fat, yield: yieldVal, grocery, steps });
    showToast('Recipe updated ✓');
  } else {
    state.recipes.push({
      id: 'custom-' + Date.now(),
      name, category, calories, protein, carbs, fat,
      yield: yieldVal, grocery, steps,
      savedAt: new Date().toISOString(),
    });
    showToast('Recipe saved ✓');
  }
  saveRecipes();
  document.getElementById('recipe-form-card').style.display = 'none';
  _editingRecipeId = null;
  renderRecipes();
}
