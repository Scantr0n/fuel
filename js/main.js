function initApp() {
  const g = state.settings.goals;
  document.getElementById('target-cal').value = g.cal;
  document.getElementById('target-pro').value = g.pro;
  document.getElementById('target-carb').value = g.carb;
  document.getElementById('target-fat').value = g.fat;
  if (state.settings.userWeight.start) document.getElementById('setup-current').value = state.settings.userWeight.start;
  if (state.settings.userWeight.goal) document.getElementById('setup-goal').value = state.settings.userWeight.goal;

  document.getElementById('recap-cal').textContent = g.cal.toLocaleString() + ' kcal';
  document.getElementById('recap-pro').textContent = g.pro + 'g';
  document.getElementById('recap-carb').textContent = g.carb + 'g';
  document.getElementById('recap-fat').textContent = g.fat + 'g';

  const typeBtn = document.getElementById('gtype-' + state.settings.goalType);
  if (typeBtn) {
    document.querySelectorAll('.goal-type-btn').forEach(b => b.classList.remove('active'));
    typeBtn.classList.add('active');
    document.getElementById('goal-weight-field').style.display = state.settings.goalType === 'lose' ? 'block' : 'none';
    document.getElementById('weight-stats').style.display = state.settings.goalType === 'track' ? 'none' : 'grid';
    document.getElementById('progress-bar-card').style.display = state.settings.goalType === 'lose' ? 'block' : 'none';
  }

  renderLogFeed();
  renderExerciseFeed();
  renderQuickAdd();
  renderGroceryList();
  renderCustomActivities();
  updateDailyTotals();
  renderProgress();
}

initApp();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.error('SW registration failed:', err));
  });
}
