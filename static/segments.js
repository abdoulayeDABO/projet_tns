let segmentsDurationChart = null;

async function refreshAudioFiles() {
  const select = document.getElementById('audioFileSelect');
  if (!select) {
    return;
  }
  const response = await fetch('/api/audio-files');
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || 'Impossible de lister les fichiers audio');
  }

  select.innerHTML = '';
  payload.files.forEach(file => {
    const option = document.createElement('option');
    option.value = file.relative_path;
    option.textContent = `${file.locuteur}/${file.session} — ${file.name}`;
    select.appendChild(option);
  });
}

function renderSegmentsTable(segments) {
  const tbody = document.querySelector('#segmentsTable tbody');
  if (!tbody) {
    return;
  }

  if (!segments.length) {
    tbody.innerHTML = '<tr><td colspan="7">Aucun segment détecté.</td></tr>';
    return;
  }

  tbody.innerHTML = segments.map((seg, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${seg.filename}</td>
      <td>${seg.duration_ms} ms</td>
      <td>${seg.start_ms} ms</td>
      <td>${seg.end_ms} ms</td>
      <td><audio controls src="${seg.url}"></audio></td>
      <td><a href="${seg.url}" download="${seg.filename}">Télécharger</a></td>
    </tr>
  `).join('');
}

function renderSegmentsDurationChart(segments) {
  if (typeof Chart === 'undefined') {
    window.showToast('Graphique indisponible temporairement (Chart.js non chargé).', 'warning');
    return;
  }
  const canvas = document.getElementById('segmentsDurationChart');
  if (!canvas) {
    return;
  }

  const labels = segments.map((_, index) => `S${index + 1}`);
  const durations = segments.map(seg => seg.duration_ms);
  if (segmentsDurationChart) {
    segmentsDurationChart.destroy();
  }
  segmentsDurationChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Durée (ms)', data: durations, backgroundColor: '#9b59b6' }]
    },
    options: window.darkChartDefaults
  });
}

async function runSegmentation() {
  const progress = document.getElementById('segmentProgress');
  try {
    const filepath = document.getElementById('audioFileSelect')?.value;
    const threshold = Number(document.getElementById('silenceThresh')?.value || 0.02);
    const minSilenceMs = Number(document.getElementById('minSilenceDuration')?.value || 300);

    if (!filepath) {
      window.showToast('Aucun fichier sélectionné pour la segmentation.', 'warning');
      return;
    }

    progress.style.width = '35%';
    const response = await fetch('/api/segment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filepath, threshold, min_silence_ms: minSilenceMs })
    });
    const payload = await response.json();
    progress.style.width = '80%';

    if (!response.ok || !payload.success) {
      throw new Error(payload.error || 'Erreur de segmentation');
    }

    renderSegmentsTable(payload.segments);
    renderSegmentsDurationChart(payload.segments);
    window.showToast(`${payload.segments.length} segment(s) généré(s).`, 'success');
  } catch (error) {
    window.showToast(error.message, 'error');
  } finally {
    progress.style.width = '100%';
    window.setTimeout(() => {
      progress.style.width = '0%';
    }, 300);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.getElementById('btnSegment')) {
    return;
  }
  const thresholdInput = document.getElementById('silenceThresh');
  const thresholdValue = document.getElementById('threshValue');
  thresholdInput.addEventListener('input', () => {
    thresholdValue.textContent = thresholdInput.value;
  });

  document.getElementById('btnSegment').addEventListener('click', runSegmentation);
  window.refreshAudioFiles = refreshAudioFiles;
  try {
    await refreshAudioFiles();
  } catch (error) {
    window.showToast(error.message, 'error');
  }
});
