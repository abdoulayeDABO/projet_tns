# TNS — ESP/UCAD (Flask)

Application web de **Traitement Numérique du Signal** avec 2 modules :

- **Numérisation & Segmentation vocale** (`/numerisation`)
- **Analyse FFT & Filtrage fréquentiel** (`/filtrage`)

## Stack

- Backend: `Flask` + `numpy` + `scipy` + `librosa` + `pydub`
- Frontend: HTML/CSS/JS vanilla
- Graphiques: `Chart.js 4.5.0`
- Icônes: `Bootstrap Icons`

## Lancer en local

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

Application disponible sur `http://localhost:5000`.

## Endpoints principaux

- `POST /api/save-recording`
- `GET /api/audio-files`
- `POST /api/segment`
- `POST /api/analyze`
- `POST /api/filter`
- `GET /audio/<path:filepath>`
- `GET /download/<filename>`

## Arborescence audio

- Enregistrements: `database/locuteur_XX/session_XX/enreg_XXX_XXkHz_XXb.wav`
- Segments: `segments/locuteur_XX/session_XX/enreg_XXX/seg_XXX.wav`
- Fichiers temporaires: `temp_uploads/`
- Sorties filtrées: `filtered_outputs/`

## Notes

- Seules les fréquences `16000`, `22050`, `44100` sont autorisées.
- Seuls les codages `16` et `32` bits sont autorisés.
- Le filtrage est **rectangulaire uniquement** (`passband` / `stopband`).
- Les formats non WAV sont convertis automatiquement en WAV côté backend.
