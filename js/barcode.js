// ─── Barcode scanning ────────────────────────────────────────────
// Prefers the native BarcodeDetector API (fast, Chrome/Android) and falls
// back to the ZXing library loaded from a CDN for browsers that don't have
// it (notably iOS Safari), so scanning works across devices either way.
let _barcodeStream = null;
let _barcodeReader = null;

async function openBarcodeScanner() {
  const usdaKey = state.settings.usdaApiKey;
  if (!usdaKey) {
    showToast('Add a USDA API key in Settings first to look up barcodes');
    return;
  }

  const overlay = document.getElementById('barcode-scanner-overlay');
  const statusEl = document.getElementById('barcode-status');
  overlay.style.display = 'flex';
  statusEl.textContent = 'Requesting camera access...';

  try {
    if ('BarcodeDetector' in window) {
      await startNativeBarcodeDetector();
    } else {
      await startZXingFallback();
    }
  } catch (err) {
    statusEl.textContent = 'Could not access camera: ' + (err.message || err);
  }
}

async function startNativeBarcodeDetector() {
  const video = document.getElementById('barcode-video');
  const statusEl = document.getElementById('barcode-status');
  _barcodeStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  video.srcObject = _barcodeStream;
  await video.play();

  let detector;
  try {
    detector = new BarcodeDetector({ formats: ['upc_a', 'upc_e', 'ean_13', 'ean_8'] });
  } catch (e) {
    return startZXingFallback();
  }
  statusEl.textContent = 'Point your camera at a barcode...';

  const scanLoop = async () => {
    if (!_barcodeStream) return; // scanner was closed
    try {
      const codes = await detector.detect(video);
      if (codes.length > 0) {
        await handleBarcodeDetected(codes[0].rawValue);
        return;
      }
    } catch (e) { /* ignore per-frame decode errors */ }
    requestAnimationFrame(scanLoop);
  };
  scanLoop();
}

function loadZXingLibrary() {
  if (window.ZXing) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load scanner library'));
    document.head.appendChild(script);
  });
}

async function startZXingFallback() {
  const statusEl = document.getElementById('barcode-status');
  statusEl.textContent = 'Loading scanner...';
  await loadZXingLibrary();
  const codeReader = new ZXing.BrowserMultiFormatReader();
  _barcodeReader = codeReader;
  statusEl.textContent = 'Point your camera at a barcode...';
  const videoInputDevices = await codeReader.listVideoInputDevices();
  const rearCamera = videoInputDevices.find(d => /back|rear|environment/i.test(d.label)) || videoInputDevices[videoInputDevices.length - 1];
  await codeReader.decodeFromVideoDevice(rearCamera ? rearCamera.deviceId : undefined, 'barcode-video', (result) => {
    if (result) handleBarcodeDetected(result.getText());
  });
}

async function handleBarcodeDetected(code) {
  closeBarcodeScanner();
  showToast(`Scanned ${code} — looking it up...`);
  const usdaKey = state.settings.usdaApiKey;
  try {
    const results = await searchUSDAByBarcode(code, usdaKey);
    if (!results.length) {
      showToast('No match found for that barcode — try Manual entry');
      return;
    }
    document.querySelectorAll('.log-tab')[1].click(); // switch to Manual tab
    const container = document.getElementById('search-results');
    container.innerHTML = results.map((f, i) => `
      <div class="search-result-item" onclick="selectSearchResult(${i})">
        <div>
          <div class="sri-name">${f.emoji} ${f.name}</div>
          <div class="sri-macros">${f.cal} cal · ${f.pro}g protein · ${f.carb}g carbs · ${f.fat}g fat${f.servingLabel ? ' · ' + f.servingLabel : ''}</div>
        </div>
        <div class="sri-add">+</div>
      </div>`).join('');
    container.dataset.results = JSON.stringify(results);
  } catch (err) {
    showToast('Barcode lookup failed — try Manual entry');
    console.error(err);
  }
}

function closeBarcodeScanner() {
  document.getElementById('barcode-scanner-overlay').style.display = 'none';
  if (_barcodeStream) {
    _barcodeStream.getTracks().forEach(t => t.stop());
    _barcodeStream = null;
  }
  if (_barcodeReader) {
    _barcodeReader.reset();
    _barcodeReader = null;
  }
}
