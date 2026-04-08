let currentFile = null;
let currentFileId = null;
let originalAnalysis = null;

let chartTimeOriginal = null;
let chartFFTOriginal = null;
let chartTimeFiltered = null;
let chartFFTFiltered = null;
let chartMask = null;
let chartFFTOverlay = null;

let dragStartX = null;

function initChartsIfPossible() {
  if (typeof Chart === 'undefined') {
    return;
  }

  if (!chartTimeOriginal) {
    chartTimeOriginal = makeLineChart('chartTimeOriginal', 'Original', 'Temps (s)', 'Amplitude', '#9b59b6');
  }
  if (!chartFFTOriginal) {
    chartFFTOriginal = makeLineChart('chartFFTOriginal', 'FFT Original', 'Fréquence (Hz)', 'Magnitude (dB)', '#9b59b6');
  }
  if (!chartTimeFiltered) {
    chartTimeFiltered = makeLineChart('chartTimeFiltered', 'Filtré', 'Temps (s)', 'Amplitude', '#47d5a6');
  }
  if (!chartFFTFiltered) {
    chartFFTFiltered = makeLineChart('chartFFTFiltered', 'FFT Filtré', 'Fréquence (Hz)', 'Magnitude (dB)', '#47d5a6');
  }

  if (originalAnalysis) {
    updateChart(chartTimeOriginal, originalAnalysis.time_axis, originalAnalysis.amplitude);
    updateChart(chartFFTOriginal, originalAnalysis.freq_axis, originalAnalysis.fft_magnitude);
  }
}

function setProgress(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.style.width = `${value}%`;
  }
}

function makeLineChart(canvasId, label, xAxis, yAxis, color = '#9b59b6') {
  if (typeof Chart === 'undefined') {
    return null;
  }
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    return null;
  }
  return new Chart(canvas, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label,
        data: [],
        borderColor: color,
        backgroundColor: 'rgba(155,89,182,0.2)',
        fill: true,
        tension: 0.1,
        pointRadius: 0
      }]
    },
    options: {
      ...window.darkChartDefaults,
      scales: {
        ...window.darkChartDefaults.scales,
        x: { ...window.darkChartDefaults.scales.x, title: { display: true, text: xAxis, color: '#8b8b8b' } },
        y: { ...window.darkChartDefaults.scales.y, title: { display: true, text: yAxis, color: '#8b8b8b' } }
      }
    }
  });
}

function updateChart(chart, labels, values) {
  if (!chart) {
    return;
  }
  chart.data.labels = labels;
  chart.data.datasets[0].data = values;
  chart.update('none');
}

function updateFileInfo(data, filename) {
  const info = document.getElementById('fileInfo');
  info.classList.remove('hidden');
  document.getElementById('fileName').textContent = `Fichier: ${filename}`;
  document.getElementById('fileDuration').textContent = `Durée: ${data.duration.toFixed(2)} s`;
  document.getElementById('fileSampleRate').textContent = `Fs: ${data.sample_rate} Hz`;
  document.getElementById('fileChannels').textContent = `Canaux: ${data.channels}`;
}

function drawMaskChart(freqAxis, fmin, fmax, filterType) {
  if (typeof Chart === 'undefined') {
    return;
  }
  const points = freqAxis.map(freq => {
    const inBand = freq >= fmin && freq <= fmax;
    if (filterType === 'passband') {
      return inBand ? 1 : 0;
    }
    return inBand ? 0 : 1;
  });

  if (!chartMask) {
    chartMask = new Chart(document.getElementById('chartMask'), {
      type: 'line',
      data: {
        labels: freqAxis,
        datasets: [{
          label: 'Masque H(f)',
          data: points,
          borderColor: '#47d5a6',
          stepped: true,
          pointRadius: 0
        }]
      },
      options: window.darkChartDefaults
    });
    return;
  }

  chartMask.data.labels = freqAxis;
  chartMask.data.datasets[0].data = points;
  chartMask.update('none');
}

function updateOverlay(freqAxis, fftOriginal, fftFiltered) {
  if (typeof Chart === 'undefined') {
    return;
  }
  if (!chartFFTOverlay) {
    chartFFTOverlay = new Chart(document.getElementById('chartFFTOverlay'), {
      type: 'line',
      data: {
        labels: freqAxis,
        datasets: [
          { label: 'Original', data: fftOriginal, borderColor: '#9b59b6', pointRadius: 0, fill: false },
          { label: 'Filtré', data: fftFiltered, borderColor: '#47d5a6', pointRadius: 0, fill: false }
        ]
      },
      options: window.darkChartDefaults
    });
    return;
  }

  chartFFTOverlay.data.labels = freqAxis;
  chartFFTOverlay.data.datasets[0].data = fftOriginal;
  chartFFTOverlay.data.datasets[1].data = fftFiltered;
  chartFFTOverlay.update('none');
}

async function analyzeFile(file) {
  try {
    const formData = new FormData();
    formData.append('audio', file);

    setProgress('analyzeProgress', 35);
    const response = await fetch('/api/analyze', { method: 'POST', body: formData });
    const payload = await response.json();
    setProgress('analyzeProgress', 85);

    if (!response.ok || !payload.success) {
      throw new Error(payload.error || 'Échec de l’analyse');
    }

    currentFileId = payload.temp_file_id;
    originalAnalysis = payload;
    updateFileInfo(payload, file.name);
    updateChart(chartTimeOriginal, payload.time_axis, payload.amplitude);
    updateChart(chartFFTOriginal, payload.freq_axis, payload.fft_magnitude);
    setProgress('analyzeProgress', 100);
    window.showToast('Analyse FFT terminée.', 'success');
  } catch (error) {
    window.showToast(error.message || 'Erreur pendant l’analyse du fichier.', 'error');
  } finally {
    window.setTimeout(() => setProgress('analyzeProgress', 0), 300);
  }
}

async function runFilter() {
  try {
    if (!currentFileId || !originalAnalysis) {
      window.showToast('Chargez et analysez un fichier d’abord.', 'warning');
      return;
    }

    const fmin = Number(document.getElementById('fmin').value);
    const fmax = Number(document.getElementById('fmax').value);
    const filterType = document.querySelector('input[name="filterType"]:checked').value;

    drawMaskChart(originalAnalysis.freq_axis, fmin, fmax, filterType);

    const response = await fetch('/api/filter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: currentFileId, fmin, fmax, filter_type: filterType })
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || 'Échec du filtrage');
    }

    updateChart(chartTimeFiltered, payload.time_axis, payload.amplitude_filtered);
    updateChart(chartFFTFiltered, payload.freq_axis, payload.fft_magnitude_filtered);
    updateOverlay(payload.freq_axis, originalAnalysis.fft_magnitude, payload.fft_magnitude_filtered);

    const resultBox = document.getElementById('filterResult');
    resultBox.classList.remove('hidden');
    document.getElementById('audioPlayer').src = payload.download_url;
    document.getElementById('btnDownload').href = payload.download_url;
    window.showToast('Filtrage appliqué avec succès.', 'success');
  } catch (error) {
    window.showToast(error.message, 'error');
  }
}

function setupDragAndDrop() {
  const dropZone = document.getElementById('dropZone');
  const input = document.getElementById('audioUpload');
  if (!dropZone || !input) {
    return;
  }

  dropZone.addEventListener('click', () => input.click());
  dropZone.addEventListener('dragover', event => {
    event.preventDefault();
    dropZone.classList.add('active');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('active'));
  dropZone.addEventListener('drop', async event => {
    event.preventDefault();
    dropZone.classList.remove('active');
    const file = event.dataTransfer.files?.[0];
    if (file) {
      currentFile = file;
      await analyzeFile(file);
    }
  });

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (file) {
      currentFile = file;
      await analyzeFile(file);
    }
  });
}

function setupFFTRangeSelection() {
  const fftCanvas = document.getElementById('chartFFTOriginal');
  if (!fftCanvas) {
    return;
  }

  fftCanvas.addEventListener('mousedown', event => {
    dragStartX = event.offsetX;
  });
  fftCanvas.addEventListener('mouseup', event => {
    if (!chartFFTOriginal || dragStartX === null) {
      return;
    }
    const scale = chartFFTOriginal.scales.x;
    const x1 = scale.getValueForPixel(dragStartX);
    const x2 = scale.getValueForPixel(event.offsetX);
    const fmin = Math.max(0, Math.min(x1, x2));
    const fmax = Math.max(x1, x2);
    document.getElementById('fmin').value = Math.round(fmin);
    document.getElementById('fmax').value = Math.round(fmax);
    dragStartX = null;
    window.showToast('Bande fréquentielle sélectionnée sur le spectre.', 'info');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('dropZone')) {
    return;
  }
  setupDragAndDrop();
  initChartsIfPossible();
  if (typeof Chart === 'undefined') {
    window.showToast('Bibliothèque de tracé indisponible. Vérifiez la connexion puis rechargez la page.', 'warning');
  }
  document.addEventListener('chartjs-ready', initChartsIfPossible, { once: true });
  setupFFTRangeSelection();
  document.getElementById('btnFilter').addEventListener('click', runFilter);
});
