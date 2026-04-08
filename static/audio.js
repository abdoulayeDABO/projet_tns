let mediaRecorder = null;
let audioChunks = [];
let audioBlob = null;
let audioContext = null;
let analyser = null;
let streamRef = null;
let liveChart = null;
let timerHandle = null;
let recordingSeconds = 0;
let chartWarningShown = false;

function formatTimer(totalSeconds) {
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function setRecordingState(recording) {
  const badge = document.getElementById('recordBadge');
  if (!badge) {
    return;
  }
  if (recording) {
    badge.classList.add('recording');
    badge.lastElementChild.textContent = 'enregistrement';
  } else {
    badge.classList.remove('recording');
    badge.lastElementChild.textContent = 'en attente';
  }
}

function initLiveChart() {
  if (typeof Chart === 'undefined') {
    if (!chartWarningShown) {
      window.showToast('Visualisation indisponible pour le moment. Réessai du tracé en cours…', 'warning');
      chartWarningShown = true;
    }
    return;
  }
  const canvas = document.getElementById('liveWaveform');
  if (!canvas) {
    return;
  }
  liveChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: Array.from({ length: 32 }, (_, i) => i),
      datasets: [{ data: Array(32).fill(0), backgroundColor: '#9b59b6', borderWidth: 0 }]
    },
    options: {
      ...window.darkChartDefaults,
      animation: false,
      plugins: { ...window.darkChartDefaults.plugins, legend: { display: false } },
      scales: { x: { display: false }, y: { display: false, min: 0, max: 255 } }
    }
  });
}

function updateLiveWaveform() {
  if (!analyser || !liveChart) {
    return;
  }
  const buffer = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(buffer);
  liveChart.data.datasets[0].data = Array.from(buffer.slice(0, 32));
  liveChart.update('none');
  requestAnimationFrame(updateLiveWaveform);
}

function updateTimerUI() {
  const timer = document.getElementById('recordTimer');
  const progress = document.getElementById('recordProgress');
  const duration = Number(document.getElementById('duration')?.value || 1);
  if (timer) {
    timer.textContent = formatTimer(recordingSeconds);
  }
  if (progress) {
    const pct = Math.min(100, (recordingSeconds / duration) * 100);
    progress.style.width = `${pct}%`;
  }
}

async function startRecording() {
  const btnRecord = document.getElementById('btnRecord');
  const btnStop = document.getElementById('btnStop');
  const btnSave = document.getElementById('btnSave');

  try {
    const sampleRate = Number(document.getElementById('sampleRate')?.value || 16000);
    if (![16000, 22050, 44100].includes(sampleRate)) {
      window.showToast('Fréquence invalide (16k, 22.05k, 44.1k uniquement).', 'error');
      return;
    }

    streamRef = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(streamRef);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);

    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
    mediaRecorder = new MediaRecorder(streamRef, mimeType ? { mimeType } : undefined);
    audioChunks = [];
    mediaRecorder.ondataavailable = event => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
      btnSave.disabled = false;
      window.showToast('Enregistrement terminé, prêt pour sauvegarde.', 'success');
    };

    mediaRecorder.start(100);
    recordingSeconds = 0;
    updateTimerUI();
    timerHandle = window.setInterval(() => {
      recordingSeconds += 1;
      updateTimerUI();
      const maxDuration = Number(document.getElementById('duration')?.value || 5);
      if (recordingSeconds >= maxDuration) {
        stopRecording();
      }
    }, 1000);

    btnRecord.disabled = true;
    btnStop.disabled = false;
    btnSave.disabled = true;
    setRecordingState(true);
    updateLiveWaveform();
    window.showToast('Enregistrement démarré.', 'info');
  } catch (error) {
    window.showToast(`Impossible d'accéder au micro: ${error.message}`, 'error');
  }
}

function stopRecording() {
  const btnRecord = document.getElementById('btnRecord');
  const btnStop = document.getElementById('btnStop');
  if (timerHandle) {
    window.clearInterval(timerHandle);
    timerHandle = null;
  }
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  if (streamRef) {
    streamRef.getTracks().forEach(track => track.stop());
  }
  if (audioContext) {
    audioContext.close();
  }
  btnRecord.disabled = false;
  btnStop.disabled = true;
  setRecordingState(false);
}

async function saveRecording() {
  if (!audioBlob) {
    window.showToast('Aucun audio à sauvegarder.', 'warning');
    return;
  }
  try {
    const sampleRate = Number(document.getElementById('sampleRate').value);
    const bitDepth = Number(document.querySelector('input[name="bit_depth"]:checked').value);
    const locuteur = document.getElementById('locuteur').value || 'locuteur_01';
    const session = document.getElementById('session').value || 'session_01';

    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    formData.append('sample_rate', String(sampleRate));
    formData.append('bit_depth', String(bitDepth));
    formData.append('locuteur', locuteur);
    formData.append('session', session);

    const response = await fetch('/api/save-recording', { method: 'POST', body: formData });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || 'Erreur de sauvegarde');
    }
    window.showToast(`Fichier sauvegardé: ${payload.filename}`, 'success');
    if (window.refreshAudioFiles) {
      await window.refreshAudioFiles();
    }
  } catch (error) {
    window.showToast(error.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('btnRecord')) {
    return;
  }
  document.getElementById('btnRecord').addEventListener('click', startRecording);
  document.getElementById('btnStop').addEventListener('click', stopRecording);
  document.getElementById('btnSave').addEventListener('click', saveRecording);
  initLiveChart();
  document.addEventListener('chartjs-ready', initLiveChart, { once: true });
});
