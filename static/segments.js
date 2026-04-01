/**
 * Script pour gérer les segments détectés
 */

function populateSegmentsTable() {
  fetch("/api/get-segments")
    .then(response => response.json())
    .then(data => {
      const segments = data.segments;
      const tbody = document.getElementById("segments-table");

      if (segments.length === 0) {
        tbody.innerHTML = `
                    <tr class="border-b border-slate-700 hover:bg-slate-700/50 transition">
                        <td colspan="5" class="py-8 px-4 text-center text-slate-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-inbox mx-auto mb-2 opacity-50">
                                <polyline points="22 12 18 12 15 21 9 21 6 12 2 12"></polyline>
                            </svg>
                            <p class="font-semibold">Aucun segment détecté</p>
                            <p class="text-xs text-slate-600 mt-1">Enregistrez et segmentez pour voir les résultats</p>
                        </td>
                    </tr>
                `;
        return;
      }

      // Remplir le tableau avec les segments
      tbody.innerHTML = segments
        .map(
          (segment, index) => `
                <tr class="border-b border-slate-700 hover:bg-slate-700/50 transition">
                    <td class="py-3 px-4 text-slate-300">${index + 1}</td>
                    <td class="py-3 px-4 text-slate-300">${segment.debut.toFixed(
                      3
                    )}s</td>
                    <td class="py-3 px-4 text-slate-300">${segment.fin.toFixed(
                      3
                    )}s</td>
                    <td class="py-3 px-4 text-slate-300">${segment.duree_ms.toFixed(
                      1
                    )}ms</td>
                    <td class="py-3 px-4">
                        <div class="flex gap-2">
                            <button onclick="playSegment(${segment.debut}, ${segment.fin})" class="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs text-white transition">
                                Écouter
                            </button>
                            <button onclick="downloadSegment(${segment.debut}, ${segment.fin}, ${index +
            1})" class="px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-xs text-white transition">
                                Télécharger
                            </button>
                        </div>
                    </td>
                </tr>
            `
        )
        .join("");
    })
    .catch(error => console.error("Erreur:", error));
}

function playSegment(start, end) {
  alert(`Écouter le segment de ${start.toFixed(3)}s à ${end.toFixed(3)}s`);
  // À implémenter avec Web Audio API
}

function downloadSegment(start, end, index) {
  alert(
    `Télécharger le segment ${index} (${start.toFixed(3)}s - ${end.toFixed(
      3
    )}s)`
  );
  // À implémenter
}
