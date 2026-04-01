/**
 * Gestion de la Partie 2: chargement audio, FFT et filtrage rectangulaire.
 */

let uploadedAudioMeta = null;
let filteredAudioUrl = null;

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function setUploadStatus(message, type = "info") {
  const statusDiv = document.getElementById("upload-status");
  if (!statusDiv) return;

  const classMap = {
    info: "bg-gray-900 border border-gray-800 text-gray-400",
    success: "bg-green-900/50 border border-green-700 text-green-300",
    error: "bg-red-900/50 border border-red-700 text-red-300"
  };

  statusDiv.className = `p-3 rounded-lg text-sm text-center mt-6 ${classMap[type] || classMap.info}`;
  statusDiv.textContent = message;
}

function setFilterResponse(message, type = "info") {
  const container = document.getElementById("filter-response");
  if (!container) return;

  const classMap = {
    info: "bg-gray-900 border border-gray-800 text-gray-300",
    success: "bg-blue-900/50 border border-blue-700 text-blue-300",
    error: "bg-red-900/50 border border-red-700 text-red-300"
  };

  container.innerHTML = `<div class="p-4 rounded-lg text-sm ${classMap[type] || classMap.info}">${message}</div>`;
}

function drawSeriesOnCanvas(canvasId, seriesList, yLabel = "Amplitude") {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(600, Math.floor(rect.width));
  canvas.height = Math.max(220, Math.floor(rect.height || 220));

  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  context.fillStyle = "#111827";
  context.fillRect(0, 0, width, height);

  const paddingLeft = 50;
  const paddingBottom = 30;
  const paddingTop = 20;
  const paddingRight = 20;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  const allX = [];
  const allY = [];
  seriesList.forEach(series => {
    allX.push(...series.x);
    allY.push(...series.y);
  });

  if (!allX.length || !allY.length) {
    context.fillStyle = "#9ca3af";
    context.fillText("Aucune donnée à afficher", paddingLeft, height / 2);
    return;
  }

  let minX = Math.min(...allX);
  let maxX = Math.max(...allX);
  let minY = Math.min(...allY);
  let maxY = Math.max(...allY);

  if (maxX - minX < 1e-12) {
    maxX = minX + 1;
  }
  if (maxY - minY < 1e-12) {
    maxY = minY + 1;
  }

  context.strokeStyle = "#374151";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(paddingLeft, paddingTop);
  context.lineTo(paddingLeft, paddingTop + plotHeight);
  context.lineTo(paddingLeft + plotWidth, paddingTop + plotHeight);
  context.stroke();

  context.fillStyle = "#9ca3af";
  context.font = "12px sans-serif";
  context.fillText(yLabel, 8, paddingTop + 12);
  context.fillText(minX.toFixed(2), paddingLeft - 10, paddingTop + plotHeight + 18);
  context.fillText(maxX.toFixed(2), paddingLeft + plotWidth - 30, paddingTop + plotHeight + 18);

  seriesList.forEach(series => {
    context.strokeStyle = series.color;
    context.lineWidth = 1.5;
    context.beginPath();

    series.x.forEach((xValue, index) => {
      const yValue = series.y[index];
      const px = paddingLeft + ((xValue - minX) / (maxX - minX)) * plotWidth;
      const py = paddingTop + (1 - (yValue - minY) / (maxY - minY)) * plotHeight;

      if (index === 0) {
        context.moveTo(px, py);
      } else {
        context.lineTo(px, py);
      }
    });

    context.stroke();
  });
}

function renderBeforePlots(data) {
  drawSeriesOnCanvas(
    "time-domain",
    [{ x: data.time_before.t, y: data.time_before.x, color: "#60a5fa" }],
    "x(t)"
  );

  drawSeriesOnCanvas(
    "frequency-domain",
    [{ x: data.freq_before.f, y: data.freq_before.mag, color: "#f59e0b" }],
    "|X(f)|"
  );
}

function renderBeforeAfterPlots(data) {
  drawSeriesOnCanvas(
    "time-domain",
    [
      { x: data.time_before.t, y: data.time_before.x, color: "#60a5fa" },
      { x: data.time_after.t, y: data.time_after.x, color: "#34d399" }
    ],
    "x(t)"
  );

  drawSeriesOnCanvas(
    "frequency-domain",
    [
      { x: data.freq_before.f, y: data.freq_before.mag, color: "#f59e0b" },
      { x: data.freq_after.f, y: data.freq_after.mag, color: "#ef4444" }
    ],
    "|X(f)|"
  );
}

async function loadAudioFile() {
  try {
    const fileInput = document.getElementById("audio_file");
    const file = fileInput?.files?.[0];

    if (!file) {
      setUploadStatus("Veuillez choisir un fichier audio.", "error");
      return;
    }

    document.getElementById("file-info")?.classList.remove("hidden");
    document.getElementById("file-name").textContent = file.name;
    document.getElementById("file-size").textContent = formatBytes(file.size);

    const formData = new FormData();
    formData.append("audio_file", file);

    setUploadStatus("Chargement du fichier en cours...", "info");

    const response = await fetch("/api/upload-audio", {
      method: "POST",
      body: formData
    });
    const payload = await response.json();

    if (!response.ok) {
      setUploadStatus(payload.error || "Erreur de chargement.", "error");
      return;
    }

    uploadedAudioMeta = payload;
    filteredAudioUrl = null;
    renderBeforePlots(payload);

    document.getElementById("playback-section")?.classList.add("hidden");
    setUploadStatus(
      `Fichier chargé: ${payload.filename} (${payload.sample_rate} Hz, ${payload.duration}s)`,
      "success"
    );
    setFilterResponse("Fichier prêt. Configurez fmin/fmax puis cliquez sur Appliquer le filtre.", "info");
  } catch (error) {
    setUploadStatus(`Erreur: ${error.message}`, "error");
  }
}

async function applyFilter() {
  try {
    if (!uploadedAudioMeta) {
      setFilterResponse("Chargez d'abord un fichier audio.", "error");
      return;
    }

    const filterForm = document.getElementById("filter-form");
    const formData = new FormData(filterForm);

    const response = await fetch("/api/apply-filter", {
      method: "POST",
      body: formData
    });
    const payload = await response.json();

    if (!response.ok) {
      setFilterResponse(payload.error || "Erreur lors du filtrage.", "error");
      return;
    }

    renderBeforeAfterPlots(payload);
    filteredAudioUrl = payload.audio_url;

    const audioPlayer = document.getElementById("audio-player");
    audioPlayer.src = `${filteredAudioUrl}?t=${Date.now()}`;

    document.getElementById("playback-section")?.classList.remove("hidden");
    setFilterResponse(
      `Filtre ${payload.filter_type} appliqué avec succès sur [${payload.fmin} Hz, ${payload.fmax} Hz].`,
      "success"
    );
  } catch (error) {
    setFilterResponse(`Erreur: ${error.message}`, "error");
  }
}

function downloadFilteredAudio() {
  if (!filteredAudioUrl) {
    setFilterResponse("Aucun signal filtré à télécharger.", "error");
    return;
  }
  window.location.href = filteredAudioUrl;
}

window.addEventListener("resize", () => {
  if (uploadedAudioMeta?.time_before && uploadedAudioMeta?.freq_before) {
    renderBeforePlots(uploadedAudioMeta);
  }
});
