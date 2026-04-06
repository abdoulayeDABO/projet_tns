// /**
//  * Gestion de la Partie 2: chargement audio, FFT et filtrage rectangulaire.
//  */

// let uploadedAudioMeta = null;
// let filteredAudioUrl = null;

// function formatBytes(bytes) {
//   if (bytes < 1024) return `${bytes} B`;
//   if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
//   return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
// }

// function setUploadStatus(message, type = "info") {
//   const statusDiv = document.getElementById("upload-status");
//   if (!statusDiv) return;

//   const classMap = {
//     info: "bg-gray-900 border border-gray-800 text-gray-400",
//     success: "bg-green-900/50 border border-green-700 text-green-300",
//     error: "bg-red-900/50 border border-red-700 text-red-300"
//   };

//   statusDiv.className = `p-3 rounded-lg text-sm text-center mt-6 ${classMap[type] || classMap.info}`;
//   statusDiv.textContent = message;
// }

// function setFilterResponse(message, type = "info") {
//   const container = document.getElementById("filter-response");
//   if (!container) return;

//   const classMap = {
//     info: "bg-gray-900 border border-gray-800 text-gray-300",
//     success: "bg-blue-900/50 border border-blue-700 text-blue-300",
//     error: "bg-red-900/50 border border-red-700 text-red-300"
//   };

//   container.innerHTML = `<div class="p-4 rounded-lg text-sm ${classMap[type] || classMap.info}">${message}</div>`;
// }

// function drawSeriesOnCanvas(canvasId, seriesList, yLabel = "Amplitude") {
//   const canvas = document.getElementById(canvasId);
//   if (!canvas) return;

//   const rect = canvas.getBoundingClientRect();
//   canvas.width = Math.max(600, Math.floor(rect.width));
//   canvas.height = Math.max(220, Math.floor(rect.height || 220));

//   const context = canvas.getContext("2d");
//   const width = canvas.width;
//   const height = canvas.height;

//   context.fillStyle = "#111827";
//   context.fillRect(0, 0, width, height);

//   const paddingLeft = 50;
//   const paddingBottom = 30;
//   const paddingTop = 20;
//   const paddingRight = 20;
//   const plotWidth = width - paddingLeft - paddingRight;
//   const plotHeight = height - paddingTop - paddingBottom;

//   const allX = [];
//   const allY = [];
//   seriesList.forEach(series => {
//     allX.push(...series.x);
//     allY.push(...series.y);
//   });

//   if (!allX.length || !allY.length) {
//     context.fillStyle = "#9ca3af";
//     context.fillText("Aucune donnée à afficher", paddingLeft, height / 2);
//     return;
//   }

//   let minX = Math.min(...allX);
//   let maxX = Math.max(...allX);
//   let minY = Math.min(...allY);
//   let maxY = Math.max(...allY);

//   if (maxX - minX < 1e-12) {
//     maxX = minX + 1;
//   }
//   if (maxY - minY < 1e-12) {
//     maxY = minY + 1;
//   }

//   context.strokeStyle = "#374151";
//   context.lineWidth = 1;
//   context.beginPath();
//   context.moveTo(paddingLeft, paddingTop);
//   context.lineTo(paddingLeft, paddingTop + plotHeight);
//   context.lineTo(paddingLeft + plotWidth, paddingTop + plotHeight);
//   context.stroke();

//   context.fillStyle = "#9ca3af";
//   context.font = "12px sans-serif";
//   context.fillText(yLabel, 8, paddingTop + 12);
//   context.fillText(minX.toFixed(2), paddingLeft - 10, paddingTop + plotHeight + 18);
//   context.fillText(maxX.toFixed(2), paddingLeft + plotWidth - 30, paddingTop + plotHeight + 18);

//   seriesList.forEach(series => {
//     context.strokeStyle = series.color;
//     context.lineWidth = 1.5;
//     context.beginPath();

//     series.x.forEach((xValue, index) => {
//       const yValue = series.y[index];
//       const px = paddingLeft + ((xValue - minX) / (maxX - minX)) * plotWidth;
//       const py = paddingTop + (1 - (yValue - minY) / (maxY - minY)) * plotHeight;

//       if (index === 0) {
//         context.moveTo(px, py);
//       } else {
//         context.lineTo(px, py);
//       }
//     });

//     context.stroke();
//   });
// }

// function renderBeforePlots(data) {
//   drawSeriesOnCanvas(
//     "time-domain",
//     [{ x: data.time_before.t, y: data.time_before.x, color: "#60a5fa" }],
//     "x(t)"
//   );

//   drawSeriesOnCanvas(
//     "frequency-domain",
//     [{ x: data.freq_before.f, y: data.freq_before.mag, color: "#f59e0b" }],
//     "|X(f)|"
//   );
// }

// function renderBeforeAfterPlots(data) {
//   drawSeriesOnCanvas(
//     "time-domain",
//     [
//       { x: data.time_before.t, y: data.time_before.x, color: "#60a5fa" },
//       { x: data.time_after.t, y: data.time_after.x, color: "#34d399" }
//     ],
//     "x(t)"
//   );

//   drawSeriesOnCanvas(
//     "frequency-domain",
//     [
//       { x: data.freq_before.f, y: data.freq_before.mag, color: "#f59e0b" },
//       { x: data.freq_after.f, y: data.freq_after.mag, color: "#ef4444" }
//     ],
//     "|X(f)|"
//   );
// }

// async function loadAudioFile() {
//   try {
//     const fileInput = document.getElementById("audio_file");
//     const file = fileInput?.files?.[0];

//     if (!file) {
//       setUploadStatus("Veuillez choisir un fichier audio.", "error");
//       return;
//     }

//     document.getElementById("file-info")?.classList.remove("hidden");
//     document.getElementById("file-name").textContent = file.name;
//     document.getElementById("file-size").textContent = formatBytes(file.size);

//     const formData = new FormData();
//     formData.append("audio_file", file);

//     setUploadStatus("Chargement du fichier en cours...", "info");

//     const response = await fetch("/api/upload-audio", {
//       method: "POST",
//       body: formData
//     });
//     const payload = await response.json();

//     if (!response.ok) {
//       setUploadStatus(payload.error || "Erreur de chargement.", "error");
//       return;
//     }

//     uploadedAudioMeta = payload;
//     filteredAudioUrl = null;
//     renderBeforePlots(payload);

//     document.getElementById("playback-section")?.classList.add("hidden");
//     setUploadStatus(
//       `Fichier chargé: ${payload.filename} (${payload.sample_rate} Hz, ${payload.duration}s)`,
//       "success"
//     );
//     setFilterResponse("Fichier prêt. Configurez fmin/fmax puis cliquez sur Appliquer le filtre.", "info");
//   } catch (error) {
//     setUploadStatus(`Erreur: ${error.message}`, "error");
//   }
// }

// async function applyFilter() {
//   try {
//     if (!uploadedAudioMeta) {
//       setFilterResponse("Chargez d'abord un fichier audio.", "error");
//       return;
//     }

//     const filterForm = document.getElementById("filter-form");
//     const formData = new FormData(filterForm);

//     const response = await fetch("/api/apply-filter", {
//       method: "POST",
//       body: formData
//     });
//     const payload = await response.json();

//     if (!response.ok) {
//       setFilterResponse(payload.error || "Erreur lors du filtrage.", "error");
//       return;
//     }

//     renderBeforeAfterPlots(payload);
//     filteredAudioUrl = payload.audio_url;

//     const audioPlayer = document.getElementById("audio-player");
//     audioPlayer.src = `${filteredAudioUrl}?t=${Date.now()}`;

//     document.getElementById("playback-section")?.classList.remove("hidden");
//     setFilterResponse(
//       `Filtre ${payload.filter_type} appliqué avec succès sur [${payload.fmin} Hz, ${payload.fmax} Hz].`,
//       "success"
//     );
//   } catch (error) {
//     setFilterResponse(`Erreur: ${error.message}`, "error");
//   }
// }

// function downloadFilteredAudio() {
//   if (!filteredAudioUrl) {
//     setFilterResponse("Aucun signal filtré à télécharger.", "error");
//     return;
//   }
//   window.location.href = filteredAudioUrl;
// }

// window.addEventListener("resize", () => {
//   if (uploadedAudioMeta?.time_before && uploadedAudioMeta?.freq_before) {
//     renderBeforePlots(uploadedAudioMeta);
//   }
// });

/**
 * Gestion de l'affichage et de la lecture des segments détectés.
 * Utilise l'API /api/get-segments et /api/download-segment/<id>
 */

let previewSegmentAudio = null;

/**
 * Charge les segments depuis le serveur et remplit le tableau HTML.
 */
function populateSegmentsTable() {
  fetch("/api/get-segments")
    .then(response => {
      if (!response.ok) {
        throw new Error(`Erreur serveur : ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      const segments = data.segments || [];
      const tbody = document.getElementById("segments-table");

      if (!tbody) {
        console.error("Élément #segments-table introuvable.");
        return;
      }

      if (segments.length === 0) {
        tbody.innerHTML = `
          <tr class="border-b border-slate-700 hover:bg-slate-700/50 transition">
            <td colspan="5" class="py-8 px-4 text-center text-slate-500">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"
                viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                class="mx-auto mb-2 opacity-50">
                <polyline points="22 12 18 12 15 21 9 21 6 12 2 12"></polyline>
              </svg>
              <p class="font-semibold text-slate-400">Aucun segment détecté</p>
              <p class="text-xs text-slate-600 mt-1">
                Enregistrez et segmentez pour voir les résultats
              </p>
            </td>
          </tr>`;
        return;
      }

      tbody.innerHTML = segments
        .map(
          (segment, index) => `
          <tr class="border-b border-slate-700 hover:bg-slate-700/50 transition">
            <td class="py-3 px-4 text-slate-300">${index + 1}</td>
            <td class="py-3 px-4 text-slate-300">
              ${Number(segment.debut).toFixed(3)}s
            </td>
            <td class="py-3 px-4 text-slate-300">
              ${Number(segment.fin).toFixed(3)}s
            </td>
            <td class="py-3 px-4 text-slate-300">
              ${Number(segment.duree_ms).toFixed(1)}ms
            </td>
            <td class="py-3 px-4">
              <div class="flex gap-2">
                <button
                  onclick="previewSegment(${index})"
                  class="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs text-white transition">
                  Écouter
                </button>
                <button
                  onclick="stopPreviewSegmentPlayback()"
                  class="px-3 py-1 bg-amber-600 hover:bg-amber-500 rounded text-xs text-white transition">
                  Stop
                </button>
                <button
                  onclick="downloadSegment(${index})"
                  class="px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-xs text-white transition">
                  Télécharger
                </button>
              </div>
            </td>
          </tr>`
        )
        .join("");
    })
    .catch(error => {
      console.error("Erreur chargement segments :", error);
      const tbody = document.getElementById("segments-table");
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="py-4 px-4 text-center text-red-400 text-sm">
              Impossible de charger les segments : ${error.message}
            </td>
          </tr>`;
      }
    });
}

/**
 * Lit un segment audio directement depuis l'API via l'élément Audio HTML5.
 * Arrête tout segment en cours avant de démarrer.
 * @param {number} segmentId - L'index du segment (0-based)
 */
function previewSegment(segmentId) {
  stopPreviewSegmentPlayback();

  previewSegmentAudio = new Audio(`/api/download-segment/${segmentId}`);

  previewSegmentAudio.play().catch(error => {
    console.error("Erreur lecture :", error);
    showSegmentError(`Lecture impossible : ${error.message}`);
  });

  previewSegmentAudio.onended = () => {
    previewSegmentAudio = null;
  };

  previewSegmentAudio.onerror = () => {
    showSegmentError("Erreur lors du chargement du segment audio.");
    previewSegmentAudio = null;
  };
}

/**
 * Stoppe la lecture du segment en cours s'il y en a un.
 */
function stopPreviewSegmentPlayback() {
  if (!previewSegmentAudio) {
    return;
  }
  previewSegmentAudio.pause();
  previewSegmentAudio.currentTime = 0;
  previewSegmentAudio = null;
}

/**
 * Déclenche le téléchargement d'un segment WAV via un lien temporaire.
 * @param {number} segmentId - L'index du segment (0-based)
 */
function downloadSegment(segmentId) {
  const link = document.createElement("a");
  link.href = `/api/download-segment/${segmentId}`;
  link.download = `segment_${String(segmentId + 1).padStart(3, "0")}.wav`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Affiche un message d'erreur dans la zone de statut si elle existe,
 * sinon dans la console.
 * @param {string} message - Le message d'erreur à afficher
 */
function showSegmentError(message) {
  const statusDiv = document.getElementById("record-status");
  if (statusDiv) {
    statusDiv.innerHTML = `
      <div class="p-3 rounded-lg text-sm bg-red-900/50 border border-red-700 text-red-300">
        ${message}
      </div>`;
  } else {
    console.error(message);
  }
}

// Initialisation au chargement de la page
document.addEventListener("DOMContentLoaded", () => {
  populateSegmentsTable();
});
