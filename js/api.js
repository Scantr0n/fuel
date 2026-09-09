const CLAUDE_MODEL = 'claude-sonnet-5';
const CLAUDE_PROXY_URL = '/.netlify/functions/claude-proxy';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// On localhost we call Anthropic directly using the key pasted into Settings
// (fine for local dev). Once deployed anywhere else, the real key lives only
// in a Netlify environment variable and requests go through the proxy function
// instead — the client never holds a real key that could be read from devtools.
function isLocalDev() {
  return ['localhost', '127.0.0.1', ''].includes(window.location.hostname);
}

// Sends a Messages API request body either directly to Anthropic (local dev,
// using the caller-supplied key) or through the Netlify proxy (deployed).
async function claudeRequest(bodyObj, apiKey) {
  const body = JSON.stringify(bodyObj);
  if (isLocalDev()) {
    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-calls': 'true' },
      body,
    });
  }
  return fetch(CLAUDE_PROXY_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
}

// ─── Photo analysis ────────────────────────────────────────────
async function callClaudeVision(imageDataUrls, note) {
  const apiKey = state.settings.apiKey;
  if (isLocalDev() && !apiKey) { await delay(1800); return mockPhotoResult(note); }
  const imageContent = imageDataUrls.map(url => {
    const [meta, data] = url.split(',');
    return { type: 'image', source: { type: 'base64', media_type: meta.match(/:(.*?);/)[1], data } };
  });
  const prompt = `You are a nutrition expert. Analyze these food photos and estimate macros.
${note ? `User note: "${note}"` : ''}
Reply ONLY with valid JSON:
{"meal_name":"string","confidence":85,"description":"string","ingredients_detected":"string","calories":420,"protein_g":35,"carbs_g":38,"fat_g":12}`;
  const res = await claudeRequest({ model: CLAUDE_MODEL, max_tokens: 400, messages: [{ role: 'user', content: [...imageContent, { type: 'text', text: prompt }] }] }, apiKey);
  if (!res.ok) throw new Error(res.status);
  const d = await res.json();
  return JSON.parse(d.content[0].text.match(/\{[\s\S]*\}/)[0]);
}

function mockPhotoResult(note) {
  const servings = note && note.match(/\d+/) ? parseInt(note.match(/\d+/)[0]) : 1;
  return { meal_name: 'Sheet Pan Egg Burrito', confidence: 82, description: `Demo mode — add your API key in Settings to analyze real photos. Showing per-serving estimate (batch of ${servings}).`, ingredients_detected: 'scrambled eggs (~3), sausage (~2oz), diced potatoes, bell peppers, onion, flour tortilla, refried beans, shredded cheese, cottage cheese', calories: Math.round(520/servings), protein_g: Math.round(38/servings), carbs_g: Math.round(44/servings), fat_g: Math.round(18/servings) };
}

// ─── Test connection ───────────────────────────────────────────
// Local dev: tests the pasted key directly against Anthropic.
async function testApiKey(apiKey) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-calls': 'true' },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 8, messages: [{ role: 'user', content: 'Reply with OK.' }] })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message || `HTTP ${res.status}`);
  }
  return true;
}

// Deployed: tests the server-side proxy instead — never sends whatever the
// user typed in the field anywhere, since that field is inert once deployed.
async function testClaudeProxy() {
  const res = await fetch(CLAUDE_PROXY_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 8, messages: [{ role: 'user', content: 'Reply with OK.' }] })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `HTTP ${res.status}`);
  }
  return true;
}

// ─── USDA FoodData Central search ───────────────────────────────
function getNutrientValue(nutrients, names) {
  for (const n of nutrients) {
    if (names.includes(n.nutrientName)) return n.value || 0;
  }
  return 0;
}

function parseUSDAFood(food) {
  let cal, pro, carb, fat, servingLabel;
  if (food.labelNutrients) {
    const ln = food.labelNutrients;
    cal = Math.round(ln.calories?.value || 0);
    pro = Math.round(ln.protein?.value || 0);
    carb = Math.round(ln.carbohydrates?.value || 0);
    fat = Math.round(ln.fat?.value || 0);
    servingLabel = food.servingSize ? `per ${food.servingSize}${food.servingSizeUnit || ''}` : 'per serving';
  } else {
    const nutrients = food.foodNutrients || [];
    cal = Math.round(getNutrientValue(nutrients, ['Energy']));
    pro = Math.round(getNutrientValue(nutrients, ['Protein']));
    carb = Math.round(getNutrientValue(nutrients, ['Carbohydrate, by difference']));
    fat = Math.round(getNutrientValue(nutrients, ['Total lipid (fat)']));
    servingLabel = 'per 100g';
  }
  if (!cal && !pro && !carb && !fat) return null;
  return {
    name: food.brandOwner ? `${food.description} (${food.brandOwner})` : food.description,
    cal, pro, carb, fat, servingLabel,
    emoji: '🔎',
  };
}

async function searchUSDA(query, apiKey) {
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(query)}&pageSize=6&dataType=Branded,Survey%20(FNDDS),SR%20Legacy`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 403) throw new Error('Invalid USDA API key');
    throw new Error('HTTP ' + res.status);
  }
  const data = await res.json();
  return (data.foods || []).map(parseUSDAFood).filter(Boolean);
}

// Barcode lookup: search by the scanned UPC/EAN digits, restricted to Branded
// foods (that's the dataset with a gtinUpc field), and sort an exact GTIN match
// to the front since USDA's free-text search doesn't otherwise prioritize it.
async function searchUSDAByBarcode(code, apiKey) {
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(code)}&pageSize=10&dataType=Branded`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 403) throw new Error('Invalid USDA API key');
    throw new Error('HTTP ' + res.status);
  }
  const data = await res.json();
  const foods = (data.foods || []).slice();
  foods.sort((a, b) => (a.gtinUpc === code ? 0 : 1) - (b.gtinUpc === code ? 0 : 1));
  return foods.map(parseUSDAFood).filter(Boolean);
}

// ─── Manual / Search food DB ────────────────────────────────────
const FOOD_DB = [
  { name: "Taco Bell Crunchwrap Supreme", cal: 530, pro: 17, carb: 69, fat: 21, emoji: '🌮' },
  { name: "Taco Bell Soft Taco", cal: 180, pro: 9, carb: 20, fat: 7, emoji: '🌮' },
  { name: "Taco Bell Bean & Cheese Burrito", cal: 380, pro: 14, carb: 55, fat: 11, emoji: '🌯' },
  { name: "McDonald's Big Mac", cal: 550, pro: 25, carb: 45, fat: 30, emoji: '🍔' },
  { name: "McDonald's McDouble", cal: 400, pro: 22, carb: 33, fat: 20, emoji: '🍔' },
  { name: "McDonald's Large Fries", cal: 490, pro: 7, carb: 66, fat: 23, emoji: '🍟' },
  { name: "Culver's ButterBurger (single)", cal: 390, pro: 18, carb: 37, fat: 18, emoji: '🍔' },
  { name: "Culver's Cheese Curds (regular)", cal: 670, pro: 26, carb: 42, fat: 44, emoji: '🧀' },
  { name: "Subway 6\" Turkey Sub", cal: 280, pro: 18, carb: 40, fat: 4, emoji: '🥖' },
  { name: "Chipotle Chicken Burrito Bowl", cal: 705, pro: 51, carb: 71, fat: 23, emoji: '🍚' },
  { name: "Chipotle Chicken Burrito", cal: 845, pro: 50, carb: 100, fat: 25, emoji: '🌯' },
  { name: "Starbucks Grande Latte (2% milk)", cal: 190, pro: 13, carb: 19, fat: 7, emoji: '☕' },
  { name: "Diet Baja Blast (20 oz)", cal: 0, pro: 0, carb: 0, fat: 0, emoji: '🥤' },
  { name: "Diet Coke (12 oz can)", cal: 0, pro: 0, carb: 0, fat: 0, emoji: '🥤' },
  { name: "Gatorade Blue (20 oz)", cal: 140, pro: 0, carb: 36, fat: 0, emoji: '🥤' },
  { name: "Banana (medium)", cal: 105, pro: 1, carb: 27, fat: 0, emoji: '🍌' },
  { name: "Apple (medium)", cal: 95, pro: 0, carb: 25, fat: 0, emoji: '🍎' },
  { name: "Greek Yogurt (1 cup, plain)", cal: 130, pro: 22, carb: 9, fat: 0, emoji: '🥛' },
  { name: "Eggs (2 large, scrambled)", cal: 180, pro: 12, carb: 2, fat: 14, emoji: '🍳' },
  { name: "Protein Shake (generic, 1 scoop)", cal: 120, pro: 24, carb: 5, fat: 2, emoji: '💪' },
  { name: "White Rice (1 cup cooked)", cal: 205, pro: 4, carb: 45, fat: 0, emoji: '🍚' },
  { name: "Chicken Breast (6 oz grilled)", cal: 185, pro: 35, carb: 0, fat: 4, emoji: '🍗' },
  { name: "Sweet Potato (medium baked)", cal: 103, pro: 2, carb: 24, fat: 0, emoji: '🍠' },
  { name: "Whole Milk (1 cup)", cal: 149, pro: 8, carb: 12, fat: 8, emoji: '🥛' },
  { name: "2% Milk (1 cup)", cal: 122, pro: 8, carb: 12, fat: 5, emoji: '🥛' },
  { name: "Cottage Cheese 2% (1/2 cup)", cal: 90, pro: 12, carb: 5, fat: 2, emoji: '🥛' },
];

// ─── Meal generation ────────────────────────────────────────────
const DEMO_MEALS = [
  { id: 1, name: 'Sheet Pan Egg Burritos', category: 'breakfast', desc: 'Meal-prep burritos with eggs, sausage, potatoes, and veggies. Make a batch of 4 on Sunday and eat all week.', calories: 480, protein: 35, carbs: 46, fat: 16, yield: 'Makes 4 burritos (per-serving macros shown)', grocery: { 'Protein': ['4 oz chicken breakfast sausage', '6 large eggs', '½ cup cottage cheese'], 'Produce': ['1 medium russet potato, diced small', '1 bell pepper, chopped', '½ white onion, chopped'], 'Dairy & Bread': ['4 large burrito-size flour tortillas', '¼ cup shredded Mexican blend cheese'], 'Canned & Pantry': ['½ cup refried beans (canned)', 'Olive oil, cumin, paprika, salt, pepper'] }, steps: ['Preheat oven to 400°F. Dice potato small, toss with olive oil, cumin, salt. Spread on a sheet pan.', 'Roast potatoes 15 min, then add sausage, bell pepper, and onion to the pan. Roast another 10 min.', 'Whisk eggs with cottage cheese, salt, and pepper. Scramble in a pan over medium heat until just set.', 'Warm tortillas. Layer refried beans, egg mixture, and sheet pan filling. Sprinkle cheese.', 'Roll into burritos. Eat one now, wrap the rest in foil, refrigerate up to 4 days.'] },
  { id: 2, name: 'High-Protein Egg White Omelette', category: 'breakfast', desc: 'Fluffy egg white omelette with spinach, mushrooms, and turkey. Ready in 10 minutes, almost no fat.', calories: 310, protein: 42, carbs: 12, fat: 8, yield: '1 serving', grocery: { 'Protein': ['6 large egg whites (or carton)', '2 oz lean deli turkey, diced'], 'Produce': ['½ cup baby spinach', '¼ cup sliced mushrooms', '2 tbsp diced onion'], 'Pantry': ['Cooking spray', 'Salt, pepper, garlic powder'] }, steps: ['Heat a non-stick pan over medium heat, spray with cooking spray.', 'Sauté mushrooms and onion 2-3 minutes until soft.', 'Whisk egg whites with salt, pepper, garlic powder. Pour into pan.', 'Add turkey and spinach to one half. When edges set, fold omelette over.', 'Cover 1 minute until cooked through. Slide onto plate.'] },
  { id: 3, name: 'Ground Turkey Taco Bowl', category: 'lunch', desc: 'Lean turkey over rice with black beans, salsa, and Greek yogurt instead of sour cream. High protein, easy macro math.', calories: 520, protein: 48, carbs: 52, fat: 12, yield: '1 serving', grocery: { 'Protein': ['5 oz 93% lean ground turkey'], 'Produce': ['2 cups romaine lettuce', '1 roma tomato, diced', '½ avocado'], 'Canned & Dry': ['½ cup black beans (canned, rinsed)', '½ cup white rice (dry)', '¼ cup salsa'], 'Dairy': ['¼ cup plain Greek yogurt (sour cream substitute)'], 'Pantry': ['Taco seasoning packet', 'Lime juice'] }, steps: ['Cook rice according to package. While rice cooks, brown turkey in a skillet over medium-high heat.', 'Drain turkey fat. Add taco seasoning and 2 tbsp water, stir to coat.', 'Warm black beans in microwave or small pot.', 'Build bowl: rice on bottom, then turkey, beans, lettuce, tomato, avocado.', 'Top with salsa and Greek yogurt. Squeeze lime juice over everything.'] },
  { id: 4, name: 'Grilled Chicken & Sweet Potato', category: 'dinner', desc: 'Seasoned grilled chicken breast with roasted sweet potato and broccoli. A clean, high-protein go-to dinner.', calories: 490, protein: 52, carbs: 40, fat: 9, yield: '1 serving', grocery: { 'Protein': ['6 oz boneless skinless chicken breast'], 'Produce': ['1 medium sweet potato', '1½ cups broccoli florets', '1 lemon'], 'Pantry': ['Olive oil', 'Garlic powder, paprika, onion powder, salt, pepper'] }, steps: ['Preheat oven to 425°F. Cube sweet potato, toss with olive oil and salt. Roast 20-25 min.', 'Pound chicken breast to even thickness. Season generously with all spices.', 'Heat grill pan or skillet over medium-high. Cook chicken 5-6 min per side until internal temp hits 165°F.', 'Add broccoli to a microwave-safe bowl with 2 tbsp water. Microwave 3 min or until tender.', 'Rest chicken 3 min before slicing. Serve with sweet potato and broccoli. Squeeze lemon over all.'] },
  { id: 5, name: 'Turkey & Hummus Wrap', category: 'lunch', desc: 'Quick no-cook lunch — deli turkey, hummus, cucumber, and spinach in a whole wheat wrap. Done in 3 minutes.', calories: 390, protein: 34, carbs: 38, fat: 10, yield: '1 wrap', grocery: { 'Protein': ['4 oz low-sodium sliced deli turkey breast'], 'Produce': ['½ cucumber, sliced thin', '1 cup baby spinach', '¼ cup shredded carrots'], 'Bread': ['1 whole wheat tortilla (10 inch)'], 'Pantry': ['3 tbsp hummus'] }, steps: ['Lay tortilla flat. Spread hummus evenly, leaving 1 inch around the edge.', 'Layer spinach, turkey slices, cucumber, and shredded carrots.', 'Fold in sides, then roll tightly from bottom. Cut in half on the diagonal.', 'Eat immediately or wrap in foil for later.'] },
  { id: 6, name: 'Cottage Cheese Protein Bowl', category: 'snack', desc: 'High-protein snack in 2 minutes. Cottage cheese with berries, honey, and granola — surprisingly filling.', calories: 280, protein: 28, carbs: 30, fat: 6, yield: '1 bowl', grocery: { 'Dairy': ['1 cup 2% cottage cheese (Daisy or Good Culture)'], 'Produce': ['½ cup blueberries', '¼ cup sliced strawberries'], 'Pantry': ['2 tbsp low-sugar granola', '1 tsp honey', 'Cinnamon (optional)'] }, steps: ['Spoon cottage cheese into a bowl.', 'Top with blueberries and strawberries.', 'Drizzle honey over the top. Sprinkle granola and cinnamon.', 'Eat immediately (granola gets soggy if it sits).'] },
  { id: 7, name: 'Salmon & Asparagus Sheet Pan', category: 'dinner', desc: 'Omega-3 packed salmon roasted with asparagus. High protein with healthy fats, ready in 20 minutes.', calories: 510, protein: 46, carbs: 14, fat: 28, yield: '1 serving', grocery: { 'Protein': ['6 oz salmon fillet (skin-on)'], 'Produce': ['1 bunch asparagus, ends trimmed', '1 lemon', '3 cloves garlic'], 'Pantry': ['Olive oil', '1 tsp Dijon mustard', 'Salt, pepper, dried dill'] }, steps: ['Preheat oven to 400°F. Line a sheet pan with foil.', 'Toss asparagus with olive oil, minced garlic, salt, and pepper. Spread on pan.', 'Mix Dijon mustard with a drizzle of olive oil, salt, pepper, and dill. Brush onto salmon.', 'Place salmon skin-side down on the pan with asparagus.', 'Roast 12-15 min until salmon flakes easily. Squeeze fresh lemon over everything.'] },
];

function buildMealPrompt(prefs) {
  const p = state.settings.profile;
  const g = state.settings.goals;
  const savedPrefs = state.settings.preferences;
  const combinedPrefs = [savedPrefs, prefs].filter(Boolean).join('; ');
  const profileLine = (p.age && p.height)
    ? `Generate 7 meals for a ${p.age}-year-old ${p.sex} targeting ~${g.cal} cal/day, ${g.pro}g protein.`
    : `Generate 7 high-protein, calorie-controlled meals targeting ~${g.cal} cal/day, ${g.pro}g protein.`;
  return `${profileLine}
${combinedPrefs ? `Preferences/restrictions: ${combinedPrefs}` : ''}
Return ONLY a valid JSON array:
[{"id":1,"name":"string","category":"breakfast|lunch|dinner|snack","desc":"string","calories":450,"protein":40,"carbs":35,"fat":12,"yield":"Makes X servings","grocery":{"Category":["item"]},"steps":["step 1","step 2","step 3"]}]`;
}

async function callClaudeMeals(prefs, apiKey) {
  const prompt = buildMealPrompt(prefs);
  const res = await claudeRequest({ model: CLAUDE_MODEL, max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }, apiKey);
  if (!res.ok) throw new Error(res.status);
  const d = await res.json();
  return JSON.parse(d.content[0].text.match(/\[[\s\S]*\]/)[0]);
}
