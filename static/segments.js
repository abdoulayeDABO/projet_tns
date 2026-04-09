let segmentsDurationChart = null;

function setAudioDropdownOpen(dropdown, trigger, isOpen) {
  if (!dropdown || !trigger) {
    return;
  }
  dropdown.classList.toggle('is-open', isOpen);
  trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

function setAudioTriggerLabel(labelElement, text) {
  if (!labelElement) {
    return;
  }
  labelElement.textContent = text;
}

function sanitizeNumericTextInputValue(input, allowDecimal = false) {
  if (!input) {
    return;
  }
  const allowedPattern = allowDecimal ? /[^0-9.,]/g : /[^0-9]/g;
  let value = String(input.value || '').replace(allowedPattern, '');
  if (allowDecimal) {
    value = value.replace(',', '.');
    const firstDotIndex = value.indexOf('.');
    if (firstDotIndex !== -1) {
      value = value.slice(0, firstDotIndex + 1) + value.slice(firstDotIndex + 1).replace(/\./g, '');
    }
  }
  input.value = value;
}

function parseNumericInput(inputId, fallbackValue, { min, max, allowDecimal = false } = {}) {
  const input = document.getElementById(inputId);
  if (!input) {
    return fallbackValue;
  }
  sanitizeNumericTextInputValue(input, allowDecimal);
  const raw = String(input.value || '').trim().replace(',', '.');
  let parsed = allowDecimal ? Number.parseFloat(raw) : Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    parsed = fallbackValue;
  }
  if (Number.isFinite(min)) {
    parsed = Math.max(min, parsed);
  }
  if (Number.isFinite(max)) {
    parsed = Math.min(max, parsed);
  }
  input.value = allowDecimal ? String(parsed) : String(Math.round(parsed));
  return parsed;
}

function toggleButtonSpinner(button, isLoading, loadingLabel) {
  if (!button) {
    return;
  }

  if (isLoading) {
    if (!button.dataset.originalHtml) {
      button.dataset.originalHtml = button.innerHTML;
    }
    button.innerHTML = `<span class="btn-spinner" aria-hidden="true"></span><span>${loadingLabel}</span>`;
    button.classList.add('is-loading');
    button.setAttribute('aria-busy', 'true');
    button.disabled = true;
    return;
  }

  if (button.dataset.originalHtml) {
    button.innerHTML = button.dataset.originalHtml;
  }
  button.classList.remove('is-loading');
  button.removeAttribute('aria-busy');
}

async function refreshAudioFiles() {
  const selectedFileInput = document.getElementById('audioFileSelect');
  const dropdown = document.getElementById('audioFileDropdown');
  const fileList = document.getElementById('audioFileList');
  const trigger = document.getElementById('audioFileTrigger');
  const triggerLabel = document.getElementById('audioFileTriggerLabel');
  if (!selectedFileInput || !dropdown || !fileList || !trigger) {
    return;
  }

  setAudioTriggerLabel(triggerLabel, 'Sélectionner un fichier audio');
  trigger.disabled = true;
  setAudioDropdownOpen(dropdown, trigger, false);

  const response = await fetch('/api/audio-files');
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || 'Impossible de lister les fichiers audio');
  }

  fileList.innerHTML = '';
  selectedFileInput.value = '';

  if (!payload.files.length) {
    setAudioTriggerLabel(triggerLabel, 'Aucun fichier disponible');
    return;
  }

  trigger.disabled = false;

  payload.files.forEach((file, index) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'audio-file-item';
    item.textContent = `${file.locuteur}/${file.session} — ${file.name}`;
    item.dataset.value = file.relative_path;

    item.addEventListener('click', () => {
      fileList.querySelectorAll('.audio-file-item').forEach(button => button.classList.remove('is-active'));
      item.classList.add('is-active');
      selectedFileInput.value = item.dataset.value;
      setAudioTriggerLabel(triggerLabel, item.textContent);
      setAudioDropdownOpen(dropdown, trigger, false);
    });

    if (index === payload.files.length - 1) {
      item.classList.add('is-active');
      selectedFileInput.value = item.dataset.value;
      setAudioTriggerLabel(triggerLabel, item.textContent);
    }

    fileList.appendChild(item);
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
  const btnSegment = document.getElementById('btnSegment');
  toggleButtonSpinner(btnSegment, true, 'Segmentation...');
  try {
    const filepath = document.getElementById('audioFileSelect')?.value;
    const threshold = Number(document.getElementById('silenceThresh')?.value || 0.02);
    const minSilenceMs = parseNumericInput('minSilenceDuration', 300, { min: 50, max: 5000 });

    if (!filepath) {
      window.showToast('Aucun fichier sélectionné pour la segmentation.', 'warning');
      return;
    }

    const response = await fetch('/api/segment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filepath, threshold, min_silence_ms: minSilenceMs })
    });
    const payload = await response.json();

    if (!response.ok || !payload.success) {
      throw new Error(payload.error || 'Erreur de segmentation');
    }

    renderSegmentsTable(payload.segments);
    renderSegmentsDurationChart(payload.segments);
    window.showToast(`${payload.segments.length} segment(s) généré(s).`, 'success');
  } catch (error) {
    window.showToast(error.message, 'error');
  } finally {
    toggleButtonSpinner(btnSegment, false);
    btnSegment.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.getElementById('btnSegment')) {
    return;
  }
  const dropdown = document.getElementById('audioFileDropdown');
  const trigger = document.getElementById('audioFileTrigger');
  const fileList = document.getElementById('audioFileList');

  if (dropdown && trigger && fileList) {
    trigger.addEventListener('click', () => {
      if (trigger.disabled) {
        return;
      }
      setAudioDropdownOpen(dropdown, trigger, !dropdown.classList.contains('is-open'));
    });

    document.addEventListener('click', (event) => {
      if (!dropdown.contains(event.target)) {
        setAudioDropdownOpen(dropdown, trigger, false);
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        setAudioDropdownOpen(dropdown, trigger, false);
      }
    });
  }

  const thresholdInput = document.getElementById('silenceThresh');
  const thresholdValue = document.getElementById('threshValue');
  thresholdInput.addEventListener('input', () => {
    thresholdValue.textContent = thresholdInput.value;
  });

  const minSilenceInput = document.getElementById('minSilenceDuration');
  if (minSilenceInput) {
    minSilenceInput.addEventListener('input', () => sanitizeNumericTextInputValue(minSilenceInput));
    minSilenceInput.addEventListener('blur', () => parseNumericInput('minSilenceDuration', 300, { min: 50, max: 5000 }));
  }

  document.getElementById('btnSegment').addEventListener('click', runSegmentation);
  window.refreshAudioFiles = refreshAudioFiles;
  try {
    await refreshAudioFiles();
  } catch (error) {
    window.showToast(error.message, 'error');
  }
});
