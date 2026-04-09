let mediaRecorder = null;
let audioChunks = [];
let audioBlob = null;
let audioContext = null;
let analyser = null;
let streamRef = null;
let liveChart = null;
let timerHandle = null;
let recordingSeconds = 0;
let audioFilename = 'recording.wav';
let isSaving = false;

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

function audioBufferToMono(audioBuffer) {
  const channels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const mono = new Float32Array(length);

  for (let channel = 0; channel < channels; channel += 1) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      mono[index] += channelData[index] / channels;
    }
  }

  return mono;
}

async function resampleMonoData(monoData, sourceSampleRate, targetSampleRate) {
  if (sourceSampleRate === targetSampleRate) {
    return monoData;
  }

  const targetLength = Math.max(
    1,
    Math.round(monoData.length * targetSampleRate / sourceSampleRate)
  );
  const offlineContext = new OfflineAudioContext(1, targetLength, targetSampleRate);
  const sourceBuffer = offlineContext.createBuffer(1, monoData.length, sourceSampleRate);
  sourceBuffer.getChannelData(0).set(monoData);

  const sourceNode = offlineContext.createBufferSource();
  sourceNode.buffer = sourceBuffer;
  sourceNode.connect(offlineContext.destination);
  sourceNode.start();

  const renderedBuffer = await offlineContext.startRendering();
  return renderedBuffer.getChannelData(0).slice();
}

function createWavBlobFromMono(monoData, sampleRate, bitDepth) {
  const bytesPerSample = bitDepth === 32 ? 4 : 2;
  const blockAlign = bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = monoData.length * bytesPerSample;
  const wavBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wavBuffer);

  const writeString = (offset, value) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let index = 0; index < monoData.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, monoData[index]));
    if (bitDepth === 32) {
      const value = sample < 0 ? sample * 2147483648 : sample * 2147483647;
      view.setInt32(offset, Math.round(value), true);
      offset += 4;
    } else {
      const value = sample < 0 ? sample * 32768 : sample * 32767;
      view.setInt16(offset, Math.round(value), true);
      offset += 2;
    }
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

async function convertBlobToWav(sourceBlob, targetSampleRate, targetBitDepth) {
  const rawArrayBuffer = await sourceBlob.arrayBuffer();
  const decodeContext = new (window.AudioContext || window.webkitAudioContext)();

  try {
    const audioBuffer = await decodeContext.decodeAudioData(rawArrayBuffer.slice(0));
    const monoData = audioBufferToMono(audioBuffer);
    const resampledData = await resampleMonoData(
      monoData,
      audioBuffer.sampleRate,
      targetSampleRate
    );
    return createWavBlobFromMono(resampledData, targetSampleRate, targetBitDepth);
  } finally {
    await decodeContext.close();
  }
}

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
  if (timer) {
    timer.textContent = formatTimer(recordingSeconds);
  }
}

async function startRecording() {
  const btnRecord = document.getElementById('btnRecord');
  const btnStop = document.getElementById('btnStop');
  const btnSave = document.getElementById('btnSave');
  toggleButtonSpinner(btnRecord, true, 'Préparation...');
  if (btnSave?.dataset?.originalHtml) {
    btnSave.innerHTML = btnSave.dataset.originalHtml;
  }
  btnSave?.classList.remove('btn-saved');

  try {
    const sampleRate = Number(document.getElementById('sampleRate')?.value || 16000);
    const bitDepth = Number(document.querySelector('input[name="bit_depth"]:checked')?.value || 16);
    if (![16000, 22050, 44100].includes(sampleRate)) {
      window.showToast('Fréquence invalide (16k, 22.05k, 44.1k uniquement).', 'error');
      return;
    }
    if (![16, 32].includes(bitDepth)) {
      window.showToast('Codage invalide (16 ou 32 bits).', 'error');
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
    audioBlob = null;
    audioFilename = 'recording.wav';
    mediaRecorder.ondataavailable = event => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      try {
        const sourceBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        audioBlob = sourceBlob;
        audioFilename = 'recording.webm';
        audioBlob = await convertBlobToWav(sourceBlob, sampleRate, bitDepth);
        audioFilename = 'recording.wav';
        btnSave.disabled = false;
        window.showToast('Enregistrement terminé, prêt pour sauvegarde.', 'success');
      } catch (error) {
        btnSave.disabled = false;
        window.showToast(`Conversion WAV indisponible (${error.message}), sauvegarde en format original.`, 'warning');
      } finally {
        toggleButtonSpinner(btnSave, false);
      }
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
    toggleButtonSpinner(btnSave, false);
    setRecordingState(true);
    updateLiveWaveform();
    window.showToast('Enregistrement démarré.', 'info');
  } catch (error) {
    window.showToast(`Impossible d'accéder au micro: ${error.message}`, 'error');
  } finally {
    toggleButtonSpinner(btnRecord, false);
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
  const btnSave = document.getElementById('btnSave');
  if (isSaving) {
    return;
  }
  if (!audioBlob) {
    window.showToast('Aucun audio à sauvegarder.', 'warning');
    return;
  }
  isSaving = true;
  toggleButtonSpinner(btnSave, true, 'Sauvegarde...');
  let saveSucceeded = false;
  try {
    const sampleRate = Number(document.getElementById('sampleRate').value);
    const bitDepth = Number(document.querySelector('input[name="bit_depth"]:checked').value);
    const locuteur = 'locuteur_01';
    const session = 'session_01';

    const formData = new FormData();
    formData.append('audio', audioBlob, audioFilename || 'recording.wav');
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
      const audioFileSelect = document.getElementById('audioFileSelect');
      if (audioFileSelect && audioFileSelect.options.length > 0) {
        audioFileSelect.selectedIndex = audioFileSelect.options.length - 1;
      }
    }
    audioBlob = null;
    audioChunks = [];
    audioFilename = 'recording.wav';
    saveSucceeded = true;
  } catch (error) {
    window.showToast(error.message, 'error');
  } finally {
    toggleButtonSpinner(btnSave, false);
    if (saveSucceeded) {
      btnSave.classList.add('btn-saved');
      btnSave.innerHTML = '<i class="bi bi-check2-circle"></i> Sauvegardé';
      btnSave.disabled = true;
    } else {
      btnSave.disabled = !audioBlob;
    }
    isSaving = false;
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
