/**
 * Gestion de la Partie 2: chargement audio, affichage des graphes backend
 * et filtrage rectangulaire.
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

function updatePlotImages(payload) {
  const timePlot = document.getElementById("time-domain-image");
  const frequencyPlot = document.getElementById("frequency-domain-image");

  if (!timePlot || !frequencyPlot) {
    return;
  }

  const version = payload.plot_version || Date.now();

  if (payload.time_plot_url) {
    timePlot.src = `${payload.time_plot_url}?v=${version}`;
  }

  if (payload.frequency_plot_url) {
    frequencyPlot.src = `${payload.frequency_plot_url}?v=${version}`;
  }
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
    updatePlotImages(payload);

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

    updatePlotImages(payload);
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
