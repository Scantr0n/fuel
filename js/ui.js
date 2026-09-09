// ─── Nav ───────────────────────────────────────────────────────
function switchPage(name, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  btn.classList.add('active');
  if (name === 'recipes') renderRecipes();
  if (name === 'progress') renderProgress();
  if (name === 'settings') renderSettings();
}

function goToLogPage() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('page-log').classList.add('active');
  document.querySelectorAll('.nav-item')[0].classList.add('active');
}

// ─── Shared toggles ────────────────────────────────────────────
function toggleExpandable(expandId, btnId, openLabel, closeLabel) {
  const exp = document.getElementById(expandId);
  const btn = document.getElementById(btnId);
  const isOpen = exp.classList.toggle('open');
  btn.textContent = isOpen ? closeLabel : openLabel;
  btn.classList.toggle('open', isOpen);
  if (isOpen) {
    exp.parentElement.querySelectorAll('.meal-expandable').forEach(el => {
      if (el.id !== expandId) el.classList.remove('open');
    });
  }
}

function toggleCheck(el) {
  el.classList.toggle('checked');
  el.textContent = el.classList.contains('checked') ? '✓' : '';
}

// ─── Toast ─────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}
