// /**
//  * Gestion complète de l'enregistrement audio et de la segmentation - Partie 1.
//  */

// let mediaRecorder;
// let audioChunks = [];
// let recordedBlob;
// let isRecording = false;
// let countdownInterval;
// let autoStopTimeout;
// let requestedSampleRate = 22050;
// let requestedBitDepth = 16;
// let currentSegmentAudio = null;

// function pickSupportedRecordingMimeType() {
//   if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) {
//     return null;
//   }

//   const candidates = [
//     "audio/webm;codecs=opus",
//     "audio/webm",
//     "audio/mp4",
//     "audio/mp4;codecs=mp4a.40.2",
//     "audio/aac",
//     "audio/wav"
//   ];

//   for (const mimeType of candidates) {
//     if (MediaRecorder.isTypeSupported(mimeType)) {
//       return mimeType;
//     }
//   }

//   return null;
// }

// function audioBufferToMono(audioBuffer) {
//   const channels = audioBuffer.numberOfChannels;
//   const length = audioBuffer.length;
//   const mono = new Float32Array(length);

//   for (let channel = 0; channel < channels; channel += 1) {
//     const channelData = audioBuffer.getChannelData(channel);
//     for (let index = 0; index < length; index += 1) {
//       mono[index] += channelData[index] / channels;
//     }
//   }

//   return mono;
// }

// async function resampleMonoData(monoData, sourceSampleRate, targetSampleRate) {
//   if (sourceSampleRate === targetSampleRate) {
//     return monoData;
//   }

//   const targetLength = Math.max(
//     1,
//     Math.round(monoData.length * targetSampleRate / sourceSampleRate)
//   );
//   const offlineContext = new OfflineAudioContext(
//     1,
//     targetLength,
//     targetSampleRate
//   );
//   const sourceBuffer = offlineContext.createBuffer(
//     1,
//     monoData.length,
//     sourceSampleRate
//   );
//   sourceBuffer.getChannelData(0).set(monoData);

//   const sourceNode = offlineContext.createBufferSource();
//   sourceNode.buffer = sourceBuffer;
//   sourceNode.connect(offlineContext.destination);
//   sourceNode.start();

//   const renderedBuffer = await offlineContext.startRendering();
//   return renderedBuffer.getChannelData(0).slice();
// }

// function createWavBlobFromMono(monoData, sampleRate, bitDepth) {
//   const bytesPerSample = bitDepth === 32 ? 4 : 2;
//   const blockAlign = bytesPerSample;
//   const byteRate = sampleRate * blockAlign;
//   const dataSize = monoData.length * bytesPerSample;
//   const wavBuffer = new ArrayBuffer(44 + dataSize);
//   const view = new DataView(wavBuffer);

//   const writeString = (offset, value) => {
//     for (let index = 0; index < value.length; index += 1) {
//       view.setUint8(offset + index, value.charCodeAt(index));
//     }
//   };

//   writeString(0, "RIFF");
//   view.setUint32(4, 36 + dataSize, true);
//   writeString(8, "WAVE");
//   writeString(12, "fmt ");
//   view.setUint32(16, 16, true);
//   view.setUint16(20, 1, true);
//   view.setUint16(22, 1, true);
//   view.setUint32(24, sampleRate, true);
//   view.setUint32(28, byteRate, true);
//   view.setUint16(32, blockAlign, true);
//   view.setUint16(34, bitDepth, true);
//   writeString(36, "data");
//   view.setUint32(40, dataSize, true);

//   let offset = 44;
//   for (let index = 0; index < monoData.length; index += 1) {
//     const sample = Math.max(-1, Math.min(1, monoData[index]));
//     if (bitDepth === 32) {
//       const value = sample < 0 ? sample * 2147483648 : sample * 2147483647;
//       view.setInt32(offset, Math.round(value), true);
//       offset += 4;
//     } else {
//       const value = sample < 0 ? sample * 32768 : sample * 32767;
//       view.setInt16(offset, Math.round(value), true);
//       offset += 2;
//     }
//   }

//   return new Blob([wavBuffer], { type: "audio/wav" });
// }

// async function convertBlobToWav(sourceBlob, targetSampleRate, targetBitDepth) {
//   const rawArrayBuffer = await sourceBlob.arrayBuffer();
//   const decodeContext = new (window.AudioContext ||
//     window.webkitAudioContext)();

//   try {
//     const audioBuffer = await decodeContext.decodeAudioData(
//       rawArrayBuffer.slice(0)
//     );
//     const monoData = audioBufferToMono(audioBuffer);
//     const resampledData = await resampleMonoData(
//       monoData,
//       audioBuffer.sampleRate,
//       targetSampleRate
//     );
//     return createWavBlobFromMono(
//       resampledData,
//       targetSampleRate,
//       targetBitDepth
//     );
//   } finally {
//     await decodeContext.close();
//   }
// }

// async function startRecording() {
//   try {
//     const frequency = parseFloat(
//       document.querySelector('select[name="frequence"]').value
//     );
//     const duration = parseInt(
//       document.querySelector('input[name="duration"]').value,
//       10
//     );
//     const codage = parseInt(
//       document.querySelector('input[name="codage"]:checked').value,
//       10
//     );

//     requestedSampleRate = Math.round(frequency * 1000);
//     requestedBitDepth = codage;

//     if (!frequency || !duration || !codage) {
//       updateStatus("Veuillez remplir tous les paramètres", "error");
//       return;
//     }

//     const validationData = new FormData();
//     validationData.append("frequence", frequency);
//     validationData.append("duration", duration);
//     validationData.append("codage", codage);

//     const validationResponse = await fetch("/api/start-recording", {
//       method: "POST",
//       body: validationData
//     });

//     document.getElementById(
//       "record-status"
//     ).innerHTML = await validationResponse.text();
//     if (!validationResponse.ok) {
//       return;
//     }

//     const stream = await navigator.mediaDevices.getUserMedia({
//       audio: {
//         sampleRate: frequency * 1000,
//         channelCount: 1,
//         echoCancellation: false,
//         noiseSuppression: false
//       }
//     });

//     const preferredMimeType = pickSupportedRecordingMimeType();
//     const options = {
//       audioBitsPerSecond: codage === 32 ? 1411200 : 705600
//     };

//     if (preferredMimeType) {
//       options.mimeType = preferredMimeType;
//     }

//     try {
//       mediaRecorder = new MediaRecorder(stream, options);
//     } catch (mimeError) {
//       mediaRecorder = new MediaRecorder(stream);
//     }

//     audioChunks = [];
//     isRecording = true;

//     mediaRecorder.ondataavailable = event => {
//       audioChunks.push(event.data);
//     };

//     mediaRecorder.onstop = async () => {
//       isRecording = false;
//       stream.getTracks().forEach(track => track.stop());

//       try {
//         const chunkType = audioChunks[0]?.type;
//         const sourceBlob = new Blob(audioChunks, {
//           type: mediaRecorder.mimeType || chunkType || "audio/webm"
//         });
//         recordedBlob = await convertBlobToWav(
//           sourceBlob,
//           requestedSampleRate,
//           requestedBitDepth
//         );
//         await saveRecording();
//       } catch (error) {
//         updateStatus(`Conversion WAV impossible: ${error.message}.`, "error");
//       }
//     };

//     mediaRecorder.start();
//     toggleRecordButtons(true);
//     startCountdownAndAutoStop(duration);
//     updateStatus(`Enregistrement en cours (${duration}s)...`, "success");
//   } catch (error) {
//     if (error.name === "NotAllowedError") {
//       updateStatus(
//         "Microphone non autorisé. Vérifiez les permissions.",
//         "error"
//       );
//       return;
//     }
//     if (error.name === "NotFoundError") {
//       updateStatus("Aucun microphone trouvé.", "error");
//       return;
//     }
//     updateStatus(`Erreur: ${error.message}`, "error");
//   }
// }

// function stopRecording() {
//   if (mediaRecorder && mediaRecorder.state !== "inactive") {
//     mediaRecorder.stop();
//   }

//   clearInterval(countdownInterval);
//   clearTimeout(autoStopTimeout);
//   isRecording = false;
//   toggleRecordButtons(false);
// }

// function toggleRecordButtons(recordingMode) {
//   const recordBtn = document.getElementById("record-btn");
//   const stopBtn = document.getElementById("stop-btn");

//   recordBtn.disabled = recordingMode;
//   stopBtn.disabled = !recordingMode;

//   if (recordingMode) {
//     recordBtn.classList.add("opacity-50", "cursor-not-allowed");
//     recordBtn.classList.remove("hover:bg-green-600");
//     stopBtn.classList.remove(
//       "opacity-50",
//       "cursor-not-allowed",
//       "bg-red-900/30",
//       "border-red-700/50"
//     );
//     stopBtn.classList.add("bg-red-700", "hover:bg-red-800");
//   } else {
//     recordBtn.classList.remove("opacity-50", "cursor-not-allowed");
//     recordBtn.classList.add("hover:bg-green-600");
//     stopBtn.classList.add(
//       "opacity-50",
//       "cursor-not-allowed",
//       "bg-red-900/30",
//       "border",
//       "border-red-700/50"
//     );
//     stopBtn.classList.remove("hover:bg-red-800", "bg-red-700");
//   }
// }

// function startCountdownAndAutoStop(maxDuration) {
//   let elapsed = 0;

//   countdownInterval = setInterval(() => {
//     elapsed += 1;
//     updateStatus(
//       `Enregistrement en cours... ${elapsed}/${maxDuration}s`,
//       "success"
//     );

//     if (elapsed >= maxDuration) {
//       clearInterval(countdownInterval);
//       stopRecording();
//       updateStatus(`Enregistrement terminé (${maxDuration}s)`, "success");
//     }
//   }, 1000);

//   autoStopTimeout = setTimeout(() => {
//     if (isRecording) {
//       stopRecording();
//     }
//   }, (maxDuration + 1) * 1000);
// }

// async function saveRecording() {
//   try {
//     if (!recordedBlob) {
//       updateStatus("Aucun enregistrement à sauvegarder", "error");
//       return;
//     }

//     const formData = new FormData();
//     formData.append("audio", recordedBlob, "recording.wav");

//     const response = await fetch("/api/save-recording", {
//       method: "POST",
//       body: formData
//     });

//     document.getElementById("record-status").innerHTML = await response.text();
//     if (response.ok) {
//       await loadSegmentsTable();
//     }
//   } catch (error) {
//     updateStatus(`Erreur: ${error.message}`, "error");
//   }
// }

// function downloadRecording() {
//   window.location.href = "/api/download-recording";
// }

// async function segmentAudio() {
//   try {
//     const form = document.getElementById("segmentation-form");
//     const formData = new FormData(form);

//     const response = await fetch("/api/segment-audio", {
//       method: "POST",
//       body: formData
//     });

//     const html = await response.text();
//     const responseContainer = document.getElementById("segmentation-response");
//     responseContainer.innerHTML = html;

//     if (response.ok) {
//       await loadSegmentsTable();
//     }
//   } catch (error) {
//     const responseContainer = document.getElementById("segmentation-response");
//     responseContainer.innerHTML = `<div class="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300">Erreur: ${error.message}</div>`;
//   }
// }

// function updateStatus(message, type = "info") {
//   const statusDiv = document.getElementById("record-status");
//   if (!statusDiv) {
//     return;
//   }

//   const classes = {
//     error: "bg-red-900/50 border border-red-700 text-red-300",
//     success: "bg-green-900/50 border border-green-700 text-green-300",
//     info: "bg-gray-900 border border-gray-700 text-gray-300"
//   };

//   statusDiv.innerHTML = `<div class="p-3 rounded-lg text-sm ${classes[type] ||
//     classes.info}">${message}</div>`;
// }

// async function loadSegmentsTable() {
//   try {
//     const response = await fetch("/api/get-segments");
//     if (!response.ok) {
//       return;
//     }

//     const data = await response.json();
//     const segments = data.segments || [];
//     const tbody = document.getElementById("segments-table");
//     if (!tbody) {
//       return;
//     }

//     if (segments.length === 0) {
//       tbody.innerHTML = `
//         <tr class="border-b border-gray-800 hover:bg-gray-900/50 transition">
//           <td colspan="5" class="py-8 px-4 text-center text-gray-500">
//             <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-2 opacity-50">
//               <polyline points="22 12 18 12 15 21 9 21 6 12 2 12"></polyline>
//             </svg>
//             <p class="font-semibold text-gray-400">Aucun segment détecté</p>
//             <p class="text-xs text-gray-600 mt-1">Enregistrez et segmentez pour voir les résultats</p>
//           </td>
//         </tr>
//       `;
//       return;
//     }

//     tbody.innerHTML = segments
//       .map((segment, index) => {
//         const segmentId = index;
//         return `
//           <tr class="border-b border-gray-800 hover:bg-gray-900/50 transition">
//             <td class="py-3 px-4 text-gray-300">${index + 1}</td>
//             <td class="py-3 px-4 text-gray-300">${Number(segment.debut).toFixed(
//               3
//             )}s</td>
//             <td class="py-3 px-4 text-gray-300">${Number(segment.fin).toFixed(
//               3
//             )}s</td>
//             <td class="py-3 px-4 text-gray-300">${Number(
//               segment.duree_ms
//             ).toFixed(1)}ms</td>
//             <td class="py-3 px-4">
//               <div class="flex gap-2">
//                 <button onclick="playSegment(${segmentId})" class="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs text-white transition">Écouter</button>
//                 <button onclick="stopSegmentPlayback()" class="px-3 py-1 bg-amber-600 hover:bg-amber-500 rounded text-xs text-white transition">Stop</button>
//                 <a href="/api/download-segment/${segmentId}" class="px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-xs text-white transition">Télécharger</a>
//               </div>
//             </td>
//           </tr>
//         `;
//       })
//       .join("");
//   } catch (error) {
//     console.error("Erreur chargement segments:", error);
//   }
// }

// function playSegment(segmentId) {
//   stopSegmentPlayback();
//   currentSegmentAudio = new Audio(`/api/download-segment/${segmentId}`);
//   currentSegmentAudio.play().catch(error => {
//     updateStatus(`Erreur lecture segment: ${error.message}`, "error");
//   });
//   currentSegmentAudio.onended = () => {
//     currentSegmentAudio = null;
//   };
// }

// function stopSegmentPlayback() {
//   if (!currentSegmentAudio) {
//     return;
//   }

//   currentSegmentAudio.pause();
//   currentSegmentAudio.currentTime = 0;
//   currentSegmentAudio = null;
// }

// document.addEventListener("DOMContentLoaded", () => {
//   toggleRecordButtons(false);
//   loadSegmentsTable();
// });


/**
 * Gestion complète de l'enregistrement audio et de la segmentation - Partie 1.
 */

let mediaRecorder;
let audioChunks = [];
let recordedBlob;
let isRecording = false;
let countdownInterval;
let autoStopTimeout;
let requestedSampleRate = 22050;
let requestedBitDepth = 16;
let currentSegmentAudio = null;

/**
 * Sélectionne le meilleur format d'enregistrement supporté par le navigateur.
 * @returns {string|null} Le MIME type supporté ou null
 */
function pickSupportedRecordingMimeType() {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) {
    return null;
  }

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/aac",
    "audio/wav"
  ];

  for (const mimeType of candidates) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return null;
}

/**
 * Mixe tous les canaux audio en un seul canal mono.
 * @param {AudioBuffer} audioBuffer - Le buffer audio source
 * @returns {Float32Array} Les données mono résultantes
 */
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

/**
 * Rééchantillonne un signal mono vers une fréquence cible via OfflineAudioContext.
 * @param {Float32Array} monoData - Les données audio mono source
 * @param {number} sourceSampleRate - La fréquence d'échantillonnage source en Hz
 * @param {number} targetSampleRate - La fréquence d'échantillonnage cible en Hz
 * @returns {Promise<Float32Array>} Les données rééchantillonnées
 */
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

/**
 * Construit un fichier WAV valide (header RIFF + PCM) depuis des données mono float32.
 * Supporte le codage 16 bits (int16) et 32 bits (int32).
 * @param {Float32Array} monoData - Les données audio [-1, 1]
 * @param {number} sampleRate - La fréquence d'échantillonnage en Hz
 * @param {number} bitDepth - La profondeur de codage (16 ou 32)
 * @returns {Blob} Le fichier WAV prêt à l'envoi
 */
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

  // En-tête RIFF
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");

  // Chunk fmt
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);        // Taille du chunk fmt
  view.setUint16(20, 1, true);         // Format PCM
  view.setUint16(22, 1, true);         // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // Chunk data
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  // Écriture des échantillons PCM
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

  return new Blob([wavBuffer], { type: "audio/wav" });
}

/**
 * Convertit un Blob audio (WebM, MP4, etc.) en WAV mono
 * au format et à la fréquence demandés.
 * @param {Blob} sourceBlob - Le blob audio source
 * @param {number} targetSampleRate - La fréquence cible en Hz
 * @param {number} targetBitDepth - La profondeur de codage cible (16 ou 32)
 * @returns {Promise<Blob>} Le blob WAV converti
 */
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

/**
 * Lance l'enregistrement audio avec les paramètres sélectionnés dans le formulaire.
 * Validation locale puis accès direct au microphone (démarrage rapide).
 */
async function startRecording() {
  try {
    const frequency = parseFloat(
      document.querySelector('select[name="frequence"]').value
    );
    const duration = parseInt(
      document.querySelector('input[name="duration"]').value,
      10
    );
    const codage = parseInt(
      document.querySelector('input[name="codage"]:checked').value,
      10
    );

    // Validation côté client avant tout
    if (!frequency || !duration || !codage) {
      updateStatus("Veuillez remplir tous les paramètres.", "error");
      return;
    }

    requestedSampleRate = Math.round(frequency * 1000);
    requestedBitDepth = codage;

    if (duration < 1 || duration > 300) {
      updateStatus("Durée invalide. Entre 1 et 300 secondes.", "error");
      return;
    }

    updateStatus("Initialisation du microphone...", "info");

    // Accès au microphone
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: requestedSampleRate,
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false
      }
    });

    const preferredMimeType = pickSupportedRecordingMimeType();

    // CORRECTION : bitrate calculé dynamiquement selon la fréquence et le codage
    const options = {
      audioBitsPerSecond: requestedSampleRate * requestedBitDepth
    };

    if (preferredMimeType) {
      options.mimeType = preferredMimeType;
    }

    try {
      mediaRecorder = new MediaRecorder(stream, options);
    } catch (mimeError) {
      // Fallback sans options si le navigateur refuse
      mediaRecorder = new MediaRecorder(stream);
    }

    audioChunks = [];
    isRecording = true;

    mediaRecorder.ondataavailable = event => {
      if (event.data && event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      isRecording = false;
      stream.getTracks().forEach(track => track.stop());

      // CORRECTION : vérification que l'enregistrement n'est pas vide
      if (audioChunks.length === 0) {
        updateStatus("Enregistrement vide. Vérifiez votre microphone.", "error");
        return;
      }

      updateStatus("Traitement en cours...", "info");

      try {
        const chunkType = audioChunks[0]?.type;
        const sourceBlob = new Blob(audioChunks, {
          type: mediaRecorder.mimeType || chunkType || "audio/webm"
        });
        updateStatus("Conversion WAV en cours...", "info");
        recordedBlob = await convertBlobToWav(
          sourceBlob,
          requestedSampleRate,
          requestedBitDepth
        );
        await saveRecording();
      } catch (error) {
        updateStatus(`Conversion WAV impossible : ${error.message}.`, "error");
      }
    };

    mediaRecorder.start();
    toggleRecordButtons(true);
    startCountdown(duration);
    updateStatus(`Enregistrement en cours (${duration}s)...`, "success");

  } catch (error) {
    if (error.name === "NotAllowedError") {
      updateStatus("Microphone non autorisé. Vérifiez les permissions.", "error");
      return;
    }
    if (error.name === "NotFoundError") {
      updateStatus("Aucun microphone trouvé.", "error");
      return;
    }
    updateStatus(`Erreur : ${error.message}`, "error");
  }
}

/**
 * Arrête manuellement l'enregistrement en cours.
 */
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }

  clearInterval(countdownInterval);
  clearTimeout(autoStopTimeout);
  isRecording = false;
  toggleRecordButtons(false);
}

/**
 * Active ou désactive les boutons Enregistrer / Stop selon l'état courant.
 * @param {boolean} recordingMode - true si un enregistrement est en cours
 */
function toggleRecordButtons(recordingMode) {
  const recordBtn = document.getElementById("record-btn");
  const stopBtn = document.getElementById("stop-btn");

  recordBtn.disabled = recordingMode;
  stopBtn.disabled = !recordingMode;

  if (recordingMode) {
    recordBtn.classList.add("opacity-50", "cursor-not-allowed");
    recordBtn.classList.remove("hover:bg-green-600");
    stopBtn.classList.remove(
      "opacity-50", "cursor-not-allowed",
      "bg-red-900/30", "border-red-700/50"
    );
    stopBtn.classList.add("bg-red-700", "hover:bg-red-800");
  } else {
    recordBtn.classList.remove("opacity-50", "cursor-not-allowed");
    recordBtn.classList.add("hover:bg-green-600");
    stopBtn.classList.add(
      "opacity-50", "cursor-not-allowed",
      "bg-red-900/30", "border", "border-red-700/50"
    );
    stopBtn.classList.remove("hover:bg-red-800", "bg-red-700");
  }
}

/**
 * Lance le décompte visuel et l'arrêt automatique à la fin de la durée.
 * CORRECTION : suppression du double timeout redondant — le clearInterval
 * dans le setInterval suffit à stopper proprement l'enregistrement.
 * @param {number} maxDuration - La durée maximale en secondes
 */
function startCountdown(maxDuration) {
  let elapsed = 0;

  countdownInterval = setInterval(() => {
    elapsed += 1;
    updateStatus(
      `Enregistrement en cours... ${elapsed}/${maxDuration}s`,
      "success"
    );

    if (elapsed >= maxDuration) {
      clearInterval(countdownInterval);
      stopRecording();
      updateStatus(`Enregistrement terminé (${maxDuration}s).`, "success");
    }
  }, 1000);

  // Sécurité : force l'arrêt si le setInterval dérape (ex: onglet mis en veille)
  autoStopTimeout = setTimeout(() => {
    if (isRecording) {
      stopRecording();
      updateStatus(`Arrêt automatique (${maxDuration}s).`, "info");
    }
  }, (maxDuration + 2) * 1000);
}

/**
 * Envoie le blob WAV converti au serveur Flask pour sauvegarde.
 */
async function saveRecording() {
  try {
    if (!recordedBlob) {
      updateStatus("Aucun enregistrement à sauvegarder.", "error");
      return;
    }

    const formData = new FormData();
    formData.append("audio", recordedBlob, "recording.wav");

    const response = await fetch("/api/save-recording", {
      method: "POST",
      body: formData
    });

    document.getElementById("record-status").innerHTML = await response.text();

    if (response.ok) {
      await loadSegmentsTable();
    }
  } catch (error) {
    updateStatus(`Erreur lors de la sauvegarde : ${error.message}`, "error");
  }
}

/**
 * Déclenche le téléchargement de l'enregistrement complet.
 */
function downloadRecording() {
  window.location.href = "/api/download-recording";
}

/**
 * Envoie les paramètres de segmentation au serveur et rafraîchit le tableau.
 */
async function segmentAudio() {
  try {
    const form = document.getElementById("segmentation-form");
    const formData = new FormData(form);

    const response = await fetch("/api/segment-audio", {
      method: "POST",
      body: formData
    });

    const html = await response.text();
    const responseContainer = document.getElementById("segmentation-response");
    responseContainer.innerHTML = html;

    if (response.ok) {
      await loadSegmentsTable();
    }
  } catch (error) {
    const responseContainer = document.getElementById("segmentation-response");
    responseContainer.innerHTML = `
      <div class="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300">
        Erreur : ${error.message}
      </div>`;
  }
}

/**
 * Met à jour le bloc de statut de l'enregistrement.
 * @param {string} message - Le message à afficher
 * @param {"info"|"success"|"error"} type - Le type de message
 */
function updateStatus(message, type = "info") {
  const statusDiv = document.getElementById("record-status");
  if (!statusDiv) {
    return;
  }

  const classes = {
    error:   "bg-red-900/50 border border-red-700 text-red-300",
    success: "bg-green-900/50 border border-green-700 text-green-300",
    info:    "bg-gray-900 border border-gray-700 text-gray-300"
  };

  statusDiv.innerHTML = `
    <div class="p-3 rounded-lg text-sm ${classes[type] || classes.info}">
      ${message}
    </div>`;
}

/**
 * Charge et affiche la liste des segments depuis le serveur.
 */
async function loadSegmentsTable() {
  try {
    const response = await fetch("/api/get-segments");
    if (!response.ok) {
      return;
    }

    const data = await response.json();
    const segments = data.segments || [];
    const tbody = document.getElementById("segments-table");

    if (!tbody) {
      return;
    }

    if (segments.length === 0) {
      tbody.innerHTML = `
        <tr class="border-b border-gray-800 hover:bg-gray-900/50 transition">
          <td colspan="5" class="py-8 px-4 text-center text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"
              viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              class="mx-auto mb-2 opacity-50">
              <polyline points="22 12 18 12 15 21 9 21 6 12 2 12"></polyline>
            </svg>
            <p class="font-semibold text-gray-400">Aucun segment détecté</p>
            <p class="text-xs text-gray-600 mt-1">
              Enregistrez et segmentez pour voir les résultats
            </p>
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = segments
      .map((segment, index) => `
        <tr class="border-b border-gray-800 hover:bg-gray-900/50 transition">
          <td class="py-3 px-4 text-gray-300">${index + 1}</td>
          <td class="py-3 px-4 text-gray-300">
            ${Number(segment.debut).toFixed(3)}s
          </td>
          <td class="py-3 px-4 text-gray-300">
            ${Number(segment.fin).toFixed(3)}s
          </td>
          <td class="py-3 px-4 text-gray-300">
            ${Number(segment.duree_ms).toFixed(1)}ms
          </td>
          <td class="py-3 px-4">
            <div class="flex gap-2">
              <button
                onclick="playSegment(${index})"
                class="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs text-white transition">
                Écouter
              </button>
              <button
                onclick="stopSegmentPlayback()"
                class="px-3 py-1 bg-amber-600 hover:bg-amber-500 rounded text-xs text-white transition">
                Stop
              </button>
              <a
                href="/api/download-segment/${index}"
                class="px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-xs text-white transition">
                Télécharger
              </a>
            </div>
          </td>
        </tr>`)
      .join("");

  } catch (error) {
    console.error("Erreur chargement segments :", error);
  }
}

/**
 * Lance la lecture d'un segment audio identifié par son index.
 * Arrête tout segment en cours avant de démarrer.
 * @param {number} segmentId - L'index du segment à lire
 */
function playSegment(segmentId) {
  stopSegmentPlayback();
  currentSegmentAudio = new Audio(`/api/download-segment/${segmentId}`);
  currentSegmentAudio.play().catch(error => {
    updateStatus(`Erreur lecture segment : ${error.message}`, "error");
  });
  currentSegmentAudio.onended = () => {
    currentSegmentAudio = null;
  };
}

/**
 * Stoppe la lecture du segment en cours s'il y en a un.
 */
function stopSegmentPlayback() {
  if (!currentSegmentAudio) {
    return;
  }
  currentSegmentAudio.pause();
  currentSegmentAudio.currentTime = 0;
  currentSegmentAudio = null;
}

// Initialisation au chargement de la page
document.addEventListener("DOMContentLoaded", () => {
  toggleRecordButtons(false);
  loadSegmentsTable();
});