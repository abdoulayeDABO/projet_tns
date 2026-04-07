"""
Routes API pour la Partie 1 - Numérisation, Segmentation
Cahier de Charge: TNS DIC2 - Dr. Moustapha MBAYE
"""

from flask import Blueprint, jsonify, send_file, request, current_app
import numpy as np
import scipy.io.wavfile as wavfile
import librosa
from pathlib import Path
import io
import errno
import time
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

api_bp = Blueprint("api", __name__)

# Paramètres globaux
FREQUENCES_AUTORISEES = [16, 22.05, 44.1]  # kHz
CODAGES_AUTORISES = [16, 32]  # bits
DUREE_MAX = 300  # secondes
SEUIL_AMPLITUDE_DEFAULT = 20  # %
SILENCE_DUREE_DEFAULT = 500  # ms

# Stockage en session
recording_session = {
    "audio_data": None,
    "sample_rate": None,
    "bit_depth": None,
    "duration": 0.0,
    "segments": [],
    "current_recording": None
}

filtering_session = {
    "original_audio": None,
    "filtered_audio": None,
    "sample_rate": None,
    "filename": None,
    "plots": {},
    "plot_version": 0
}


def _normalize_audio_float(audio_data):
    """Convertit les données audio en float32 mono normalisé [-1, 1]."""
    if len(audio_data.shape) > 1:
        audio_data = np.mean(audio_data, axis=1)

    if audio_data.dtype == np.int16:
        return audio_data.astype(np.float32) / 32768.0
    if audio_data.dtype == np.int32:
        return audio_data.astype(np.float32) / 2147483648.0
    return audio_data.astype(np.float32)


def _to_int16_wav(audio_data_float):
    """Convertit un signal float32 [-1, 1] en int16 WAV."""
    max_abs = np.max(np.abs(audio_data_float)) if len(audio_data_float) else 1.0
    if max_abs > 1.0:
        audio_data_float = audio_data_float / max_abs
    return np.clip(audio_data_float * 32767.0, -32768, 32767).astype(np.int16)


def _downsample_for_plot(x_values, y_values, max_points=2500):
    """Réduit le nombre de points d'un tracé pour l'affichage web."""
    n_points = len(x_values)
    if n_points <= max_points:
        return x_values.tolist(), y_values.tolist()

    step = max(1, n_points // max_points)
    return x_values[::step].tolist(), y_values[::step].tolist()


def _compute_fft(audio_data, sample_rate):
    """Calcule le spectre d'amplitude et les fréquences correspondantes."""
    spectrum = np.fft.fft(audio_data)
    freqs = np.fft.fftfreq(len(audio_data), d=1.0 / sample_rate)
    amplitudes = np.abs(spectrum)
    return freqs, amplitudes, spectrum


def _render_plot_png(series, title, x_label, y_label):
    """Génère un graphique PNG en mémoire à partir d'une ou plusieurs séries."""
    figure, axis = plt.subplots(figsize=(10, 3.2), dpi=120)
    figure.patch.set_facecolor("#111827")
    axis.set_facecolor("#111827")

    for item in series:
        axis.plot(
            item["x"],
            item["y"],
            color=item.get("color", "#60a5fa"),
            linewidth=1.3,
            label=item.get("label", "")
        )

    axis.set_title(title, color="#e5e7eb", fontsize=11)
    axis.set_xlabel(x_label, color="#d1d5db", fontsize=9)
    axis.set_ylabel(y_label, color="#d1d5db", fontsize=9)
    axis.tick_params(colors="#9ca3af", labelsize=8)
    axis.grid(color="#374151", alpha=0.35, linewidth=0.8)

    for spine in axis.spines.values():
        spine.set_color("#374151")

    labels = [item.get("label", "") for item in series if item.get("label")]
    if labels:
        legend = axis.legend(facecolor="#111827", edgecolor="#374151", fontsize=8)
        for text in legend.get_texts():
            text.set_color("#e5e7eb")

    buffer = io.BytesIO()
    figure.tight_layout()
    figure.savefig(buffer, format="png", facecolor=figure.get_facecolor())
    plt.close(figure)
    buffer.seek(0)
    return buffer.getvalue()


def _update_filter_plots(original_audio, filtered_audio, sample_rate):
    """Met à jour les graphes temporels/fréquentiels de la session de filtrage."""
    time_axis = np.arange(len(original_audio), dtype=np.float32) / float(sample_rate)
    time_before_x, time_before_y = _downsample_for_plot(time_axis, original_audio)

    time_series = [{
        "x": time_before_x,
        "y": time_before_y,
        "color": "#60a5fa",
        "label": "Avant filtrage"
    }]

    freqs_before, amps_before, _ = _compute_fft(original_audio, sample_rate)
    positive_before = freqs_before >= 0
    freq_before_x, freq_before_y = _downsample_for_plot(
        freqs_before[positive_before],
        amps_before[positive_before]
    )
    freq_series = [{
        "x": freq_before_x,
        "y": freq_before_y,
        "color": "#f59e0b",
        "label": "Avant filtrage"
    }]

    if filtered_audio is not None:
        time_after_x, time_after_y = _downsample_for_plot(time_axis, filtered_audio)
        time_series.append({
            "x": time_after_x,
            "y": time_after_y,
            "color": "#34d399",
            "label": "Après filtrage"
        })

        freqs_after, amps_after, _ = _compute_fft(filtered_audio, sample_rate)
        positive_after = freqs_after >= 0
        freq_after_x, freq_after_y = _downsample_for_plot(
            freqs_after[positive_after],
            amps_after[positive_after]
        )
        freq_series.append({
            "x": freq_after_x,
            "y": freq_after_y,
            "color": "#ef4444",
            "label": "Après filtrage"
        })

    time_plot = _render_plot_png(
        time_series,
        "Signal temporel x(t)",
        "Temps (s)",
        "Amplitude"
    )
    freq_plot = _render_plot_png(
        freq_series,
        "Spectre d'amplitude |X(f)|",
        "Fréquence (Hz)",
        "Amplitude"
    )

    filtering_session["plots"] = {
        "time-domain": time_plot,
        "frequency-domain": freq_plot
    }
    filtering_session["plot_version"] = int(time.time() * 1000)


def _get_audio_storage_root():
    """Retourne le dossier de stockage audio writable.

    En déploiement serverless (ex: Vercel), le filesystem du projet est
    read-only. On tente d'abord le dossier configuré, puis on bascule
    automatiquement vers `/tmp/tns_data` si nécessaire.
    """
    configured_dir = current_app.config.get("AUDIO_STORAGE_DIR")
    primary_root = Path(configured_dir) if configured_dir else Path("/tmp/tns_data")

    try:
        primary_root.mkdir(parents=True, exist_ok=True)
        return primary_root
    except OSError as error:
        if error.errno not in (errno.EROFS, errno.EACCES, errno.EPERM):
            raise

    fallback_root = Path("/tmp/tns_data")
    fallback_root.mkdir(parents=True, exist_ok=True)
    return fallback_root


def _format_frequency_label(sample_rate):
    """Formate la fréquence pour les noms de fichiers.

    Exemples:
    - 16000 Hz -> 16kHz
    - 22050 Hz -> 22_05kHz
    - 44100 Hz -> 44_1kHz
    """
    khz_value = sample_rate / 1000.0

    if float(khz_value).is_integer():
        return f"{int(khz_value)}kHz"

    khz_text = f"{khz_value:.2f}".rstrip("0").rstrip(".")
    return f"{khz_text.replace('.', '_')}kHz"


def validate_parameters(frequency, duration, codage):
    """
    Valide les paramètres d'enregistrement selon le cahier des charges
    
    Args:
        frequency: Fréquence en kHz
        duration: Durée en secondes
        codage: Codage en bits
    
    Returns:
        Tuple (valid, message)
    """
    if frequency not in FREQUENCES_AUTORISEES:
        return False, f"Fréquence invalide. Autorisées: {FREQUENCES_AUTORISEES} kHz"
    
    if codage not in CODAGES_AUTORISES:
        return False, f"Codage invalide. Autorisé: {CODAGES_AUTORISES} bits"
    
    if not (1 <= duration <= DUREE_MAX):
        return False, f"Durée invalide. Entre 1 et {DUREE_MAX} secondes"
    
    return True, "Paramètres valides"


def detect_segments(audio_data, sample_rate, amplitude_threshold, silence_duration):
    """
    Détecte les segments de parole dans l'audio en utilisant la détection d'amplitude
    
    Args:
        audio_data: Données audio (numpy array)
        sample_rate: Fréquence d'échantillonnage en Hz
        amplitude_threshold: Seuil d'amplitude (0-100) en pourcentage
        silence_duration: Durée minimale de silence en ms
    
    Returns:
        Liste de segments {"debut", "fin", "duree_ms"}
    """
    try:
        # Convertir en float32 normalisé
        if audio_data.dtype == np.int16:
            audio_normalized = audio_data.astype(np.float32) / 32768.0
        elif audio_data.dtype == np.int32:
            audio_normalized = audio_data.astype(np.float32) / 2147483648.0
        else:
            audio_normalized = audio_data.astype(np.float32)
        
        # Calcul de l'enveloppe d'amplitude
        frame_length = sample_rate // 100  # 10ms frames
        hop_length = frame_length // 2
        
        # Calculer la puissance par frame
        energy = []
        for i in range(0, len(audio_normalized) - frame_length, hop_length):
            frame = audio_normalized[i:i + frame_length]
            power = np.mean(frame ** 2)
            energy.append(power)
        
        energy = np.array(energy)
        
        # Normaliser l'énergie et convertir le seuil
        energy_normalized = energy / (np.max(energy) + 1e-10)
        threshold_normalized = amplitude_threshold / 100.0
        
        # Déterminer les frames avec signal
        frames_with_signal = energy_normalized > threshold_normalized
        
        # Convertir silence_duration de ms en frames
        frame_duration_ms = (hop_length / sample_rate) * 1000
        min_frames = int(silence_duration / frame_duration_ms)
        
        # Appliquer une fermeture morphologique
        from scipy.ndimage import binary_closing
        kernel = np.ones(max(1, min_frames))
        frames_smooth = binary_closing(frames_with_signal, structure=kernel)
        
        # Détecter les transitions
        transitions = np.diff(frames_smooth.astype(int))
        starts = np.where(transitions == 1)[0]
        ends = np.where(transitions == -1)[0]
        
        # S'assurer que nous avons des paires start/end
        if len(starts) > len(ends):
            ends = np.append(ends, len(frames_smooth) - 1)
        if len(ends) > len(starts):
            starts = np.insert(starts, 0, 0)
        
        # Convertir les indices de frames en secondes
        segments = []
        for idx, (start, end) in enumerate(zip(starts, ends), 1):
            start_time = (start * hop_length) / sample_rate
            end_time = (end * hop_length) / sample_rate
            duration_ms = (end_time - start_time) * 1000
            
            # Filtrer les segments trop courts
            if duration_ms >= silence_duration and duration_ms < 600000:
                segments.append({
                    "numero": idx,
                    "debut": round(start_time, 3),
                    "fin": round(end_time, 3),
                    "duree_ms": round(duration_ms, 1)
                })
        
        return segments
    
    except Exception as e:
        print(f"Erreur dans detect_segments: {str(e)}")
        return []


@api_bp.post("/api/start-recording")
def start_recording():
    """Valide les paramètres et prépare l'enregistrement"""
    try:
        frequency = float(request.form.get("frequence", 22.05))
        duration = int(request.form.get("duration", 10))
        codage = int(request.form.get("codage", 16))
        
        valid, msg = validate_parameters(frequency, duration, codage)
        
        if not valid:
            return f"""
            <div class="p-4 bg-red-900/50 border border-red-700 rounded-lg">
                <div class="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-400">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <p class="text-red-300 font-semibold">{msg}</p>
                </div>
            </div>
            """
        
        recording_session.update({
            "frequency": frequency,
            "duration": duration,
            "bit_depth": codage,
            "sample_rate": int(frequency * 1000)
        })
        
        html_response = f"""
        <div class="p-4 bg-green-900/50 border border-green-700 rounded-lg">
            <div class="flex items-center gap-2 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-400">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <path d="m9 11 3 3L22 4"></path>
                </svg>
                <p class="text-green-300 font-semibold">Paramètres acceptés ✓</p>
            </div>
            <p class="text-sm text-green-200">
                <strong>Fréquence:</strong> {frequency} kHz<br>
                <strong>Durée:</strong> {duration}s<br>
                <strong>Codage:</strong> {codage} bits<br>
                <span class="text-xs text-green-300 mt-2 block">Microphone: Prêt à enregistrer</span>
            </p>
        </div>
        """
        return html_response
        
    except Exception as e:
        return f"""
        <div class="p-4 bg-red-900/50 border border-red-700 rounded-lg">
            <p class="text-red-300">Erreur: {str(e)}</p>
        </div>
        """, 400


@api_bp.post("/api/save-recording")
def save_recording():
    """Sauvegarde un enregistrement WAV déjà converti côté navigateur."""
    try:
        if 'audio' not in request.files:
            return """
            <div class="p-4 bg-red-900/50 border border-red-700 rounded-lg">
                <p class="text-red-300">Aucun fichier audio reçu</p>
            </div>
            """, 400
        
        audio_file = request.files['audio']
        audio_bytes = audio_file.read()

        wav_headers = (b"RIFF", b"RIFX", b"RF64")
        has_wav_header = len(audio_bytes) >= 4 and audio_bytes[:4] in wav_headers

        if not has_wav_header:
            return """
            <div class="p-4 bg-red-900/50 border border-red-700 rounded-lg">
                <p class="text-red-300">Format non-WAV reçu. La conversion en WAV doit être faite côté navigateur avant l'envoi.</p>
            </div>
            """, 400

        try:
            sample_rate, audio_data = wavfile.read(io.BytesIO(audio_bytes))
        except Exception as wav_error:
            return f"""
            <div class="p-4 bg-red-900/50 border border-red-700 rounded-lg">
                <p class="text-red-300">WAV invalide ou corrompu. Détail: {str(wav_error)}</p>
            </div>
            """, 400
        
        # Gérer les stéréo -> mono
        if len(audio_data.shape) > 1:
            audio_data = np.mean(audio_data, axis=1).astype(audio_data.dtype)
        
        # Déterminer le type de données
        if audio_data.dtype == np.int16:
            bit_depth = 16
        elif audio_data.dtype == np.int32:
            bit_depth = 32
        else:
            bit_depth = 16
        
        # Créer le répertoire de stockage (configurable en déploiement)
        locuteur = "locuteur_01"
        db_dir = _get_audio_storage_root()
        locuteur_dir = db_dir / locuteur
        
        if not locuteur_dir.exists():
            session_number = 1
        else:
            existing_sessions = [
                int(d.name.split("_")[1]) for d in locuteur_dir.iterdir() 
                if d.is_dir() and d.name.startswith("session_")
            ]
            session_number = max(existing_sessions) + 1 if existing_sessions else 1
        
        session_dir = locuteur_dir / f"session_{session_number:02d}"
        session_dir.mkdir(parents=True, exist_ok=True)
        
        existing_recordings = [
            f for f in session_dir.iterdir() 
            if f.is_file() and f.name.startswith("enreg_") and f.suffix == ".wav"
        ]
        recording_count = len(existing_recordings) + 1
        
        frequency_label = _format_frequency_label(sample_rate)
        filename_str = f"enreg_{recording_count:03d}_{frequency_label}_{bit_depth}b.wav"
        file_path = session_dir / filename_str
        
        wavfile.write(str(file_path), sample_rate, audio_data)
        
        recording_session.update({
            "audio_data": audio_data,
            "sample_rate": sample_rate,
            "bit_depth": bit_depth,
            "duration": len(audio_data) / sample_rate,
            "file_path": str(file_path),
            "filename": filename_str,
            "session_dir": str(session_dir)
        })
        
        html_response = f"""
        <div class="p-4 bg-green-900/50 border border-green-700 rounded-lg">
            <div class="flex items-center gap-2 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-400">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <path d="m9 11 3 3L22 4"></path>
                </svg>
                <p class="text-green-300 font-semibold">Enregistrement sauvegardé </p>
            </div>
            <p class="text-sm text-green-200">
                <strong>Fichier:</strong> {filename_str}<br>
                <strong>Fréquence:</strong> {sample_rate} Hz ({frequency_label})<br>
                <strong>Durée:</strong> {recording_session['duration']:.1f}s<br>
                <strong>Codage:</strong> {bit_depth} bits<br>
                <strong>Chemin:</strong> {session_dir}/
            </p>
        </div>
        """
        
        return html_response

    except OSError as e:
        if e.errno == errno.EROFS:
            storage_dir = current_app.config.get("AUDIO_STORAGE_DIR", "/tmp/tns_data")
            return f"""
            <div class="p-4 bg-red-900/50 border border-red-700 rounded-lg">
                <p class="text-red-300">Système de fichiers en lecture seule. Configurez <code>AUDIO_STORAGE_DIR</code> vers un volume writable (ex: <code>/tmp/tns_data</code> ou un volume monté). Dossier actuel: {storage_dir}</p>
            </div>
            """, 400
        print(f"Erreur système lors de la sauvegarde: {str(e)}")
        return f"""
        <div class="p-4 bg-red-900/50 border border-red-700 rounded-lg">
            <p class="text-red-300">Erreur système: {str(e)}</p>
        </div>
        """, 400
        
    except Exception as e:
        print(f"Erreur lors de la sauvegarde: {str(e)}")
        return f"""
        <div class="p-4 bg-red-900/50 border border-red-700 rounded-lg">
            <p class="text-red-300">Erreur: {str(e)}</p>
        </div>
        """, 400


@api_bp.post("/api/segment-audio")
def segment_audio():
    """Segmente l'audio enregistré par détection de silence"""
    try:
        if recording_session.get("audio_data") is None:
            return """
            <div class="p-4 bg-red-900/50 border border-red-700 rounded-lg">
                <div class="flex items-center gap-2 mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-400">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <p class="text-red-300 font-semibold">Aucun enregistrement</p>
                </div>
                <p class="text-sm text-red-200">Veuillez d'abord enregistrer un audio</p>
            </div>
            """
        
        seuil_amplitude = int(request.form.get("seuil_amplitude", SEUIL_AMPLITUDE_DEFAULT))
        silence_duree = int(request.form.get("silence_duree", SILENCE_DUREE_DEFAULT))
        
        if not (0 <= seuil_amplitude <= 100):
            seuil_amplitude = SEUIL_AMPLITUDE_DEFAULT
        if not (50 <= silence_duree <= 2000):
            silence_duree = SILENCE_DUREE_DEFAULT
        
        segments = detect_segments(
            recording_session["audio_data"],
            recording_session["sample_rate"],
            seuil_amplitude,
            silence_duree
        )
        
        recording_session["segments"] = segments
        
        html_response = f"""
        <div class="p-4 bg-blue-900/50 border border-blue-700 rounded-lg">
            <div class="flex items-center gap-2 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-400">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <path d="m9 11 3 3L22 4"></path>
                </svg>
                <p class="text-blue-300 font-semibold">Segmentation réussie </p>
            </div>
            <p class="text-sm text-blue-200">
                <strong>{len(segments)} segment(s) détecté(s)</strong><br>
                Seuil: {seuil_amplitude}% | Silence min: {silence_duree}ms
            </p>
        </div>
        """
        return html_response
        
    except Exception as e:
        print(f"Erreur lors de la segmentation: {str(e)}")
        return f"""
        <div class="p-4 bg-red-900/50 border border-red-700 rounded-lg">
            <p class="text-red-300">Erreur: {str(e)}</p>
        </div>
        """, 400


@api_bp.get("/api/get-segments")
def get_segments():
    """Retourne les segments au format JSON"""
    try:
        segments = recording_session.get("segments", [])
        return jsonify({
            "segments": segments,
            "count": len(segments)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@api_bp.get("/api/download-segment/<int:segment_id>")
def download_segment(segment_id):
    """Télécharge un segment audio spécifique"""
    try:
        segments = recording_session.get("segments", [])
        
        if segment_id < 0 or segment_id >= len(segments):
            return "Segment non trouvé", 404
        
        segment = segments[segment_id]
        audio_data = recording_session.get("audio_data")
        sample_rate = recording_session.get("sample_rate")
        
        if audio_data is None or sample_rate is None:
            return "Données audio non disponibles", 400
        
        start_sample = int(segment["debut"] * sample_rate)
        end_sample = int(segment["fin"] * sample_rate)
        segment_audio = audio_data[start_sample:end_sample]
        
        wav_buffer = io.BytesIO()
        wavfile.write(wav_buffer, sample_rate, segment_audio)
        wav_buffer.seek(0)
        
        return send_file(
            wav_buffer,
            mimetype="audio/wav",
            as_attachment=True,
            download_name=f"segment_{segment_id + 1:03d}.wav"
        )
        
    except Exception as e:
        return f"Erreur: {str(e)}", 400


@api_bp.get("/api/download-recording")
def download_recording():
    """Télécharge l'enregistrement complet"""
    try:
        if recording_session.get("file_path") is None:
            return "Aucun enregistrement disponible", 400
        
        file_path = Path(recording_session["file_path"])
        
        if not file_path.exists():
            return "Le fichier n'existe pas", 404
        
        return send_file(
            str(file_path),
            as_attachment=True,
            download_name=recording_session.get("filename", "recording.wav"),
            mimetype="audio/wav"
        )
        
    except Exception as e:
        return f"Erreur: {str(e)}", 400


@api_bp.post("/api/upload-audio")
def upload_audio_for_filtering():
    """Charge un fichier audio et prépare les graphes générés côté backend."""
    try:
        if "audio_file" not in request.files:
            return jsonify({"error": "Aucun fichier audio reçu"}), 400

        audio_file = request.files["audio_file"]
        filename = audio_file.filename or "audio_input"
        file_bytes = audio_file.read()
        if not file_bytes:
            return jsonify({"error": "Fichier audio vide"}), 400

        try:
            sample_rate, audio_data = wavfile.read(io.BytesIO(file_bytes))
            audio_float = _normalize_audio_float(audio_data)
        except Exception:
            audio_float, sample_rate = librosa.load(io.BytesIO(file_bytes), sr=None, mono=True)
            audio_float = audio_float.astype(np.float32)

        filtering_session.update({
            "original_audio": audio_float,
            "filtered_audio": None,
            "sample_rate": int(sample_rate),
            "filename": filename
        })

        _update_filter_plots(audio_float, None, sample_rate)

        return jsonify({
            "message": "Fichier chargé avec succès",
            "filename": filename,
            "sample_rate": int(sample_rate),
            "duration": round(len(audio_float) / float(sample_rate), 3),
            "time_plot_url": "/api/filter-plot/time-domain",
            "frequency_plot_url": "/api/filter-plot/frequency-domain",
            "plot_version": filtering_session.get("plot_version", 0)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@api_bp.post("/api/apply-filter")
def apply_rectangular_filter():
    """Applique un masque fréquentiel rectangulaire passe-bande ou coupe-bande puis reconstruit le signal."""
    try:
        original_audio = filtering_session.get("original_audio")
        sample_rate = filtering_session.get("sample_rate")

        if original_audio is None or sample_rate is None:
            return jsonify({"error": "Aucun audio chargé. Chargez d'abord un fichier."}), 400

        filter_type = request.form.get("filter_type", "bandpass")
        fmin = float(request.form.get("fmin", 100))
        fmax = float(request.form.get("fmax", 4000))

        nyquist = sample_rate / 2.0
        if fmin < 0 or fmax <= 0 or fmin >= fmax:
            return jsonify({"error": "Bornes invalides: il faut 0 ≤ fmin < fmax."}), 400
        if fmax > nyquist:
            return jsonify({"error": f"fmax doit être ≤ fréquence de Nyquist ({nyquist:.1f} Hz)."}), 400
        if filter_type not in ["bandpass", "bandstop"]:
            return jsonify({"error": "Type de filtre invalide (bandpass|bandstop)."}), 400

        freqs, original_amp, original_spectrum = _compute_fft(original_audio, sample_rate)

        passband_mask = ((np.abs(freqs) >= fmin) & (np.abs(freqs) <= fmax)).astype(np.float32)
        if filter_type == "bandpass":
            rectangular_mask = passband_mask
        else:
            rectangular_mask = 1.0 - passband_mask

        filtered_spectrum = original_spectrum * rectangular_mask
        filtered_audio = np.real(np.fft.ifft(filtered_spectrum)).astype(np.float32)

        filtering_session["filtered_audio"] = filtered_audio

        _update_filter_plots(original_audio, filtered_audio, sample_rate)

        return jsonify({
            "message": "Filtrage appliqué avec succès",
            "filter_type": filter_type,
            "fmin": fmin,
            "fmax": fmax,
            "time_plot_url": "/api/filter-plot/time-domain",
            "frequency_plot_url": "/api/filter-plot/frequency-domain",
            "plot_version": filtering_session.get("plot_version", 0),
            "audio_url": "/api/download-filtered-audio"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@api_bp.get("/api/download-filtered-audio")
def download_filtered_audio():
    """Télécharge le signal filtré reconstruit au format WAV."""
    try:
        filtered_audio = filtering_session.get("filtered_audio")
        sample_rate = filtering_session.get("sample_rate")

        if filtered_audio is None or sample_rate is None:
            return "Aucun signal filtré disponible", 400

        output_buffer = io.BytesIO()
        wavfile.write(output_buffer, sample_rate, _to_int16_wav(filtered_audio))
        output_buffer.seek(0)

        input_name = filtering_session.get("filename") or "audio"
        stem = Path(input_name).stem
        return send_file(
            output_buffer,
            mimetype="audio/wav",
            as_attachment=True,
            download_name=f"{stem}_filtre.wav"
        )
    except Exception as e:
        return f"Erreur: {str(e)}", 400


@api_bp.get("/api/filter-plot/<plot_name>")
def download_filter_plot(plot_name):
    """Retourne un graphique PNG généré côté backend pour la Partie 2."""
    try:
        plots = filtering_session.get("plots") or {}
        plot_bytes = plots.get(plot_name)

        if plot_bytes is None:
            return "Graphique non disponible", 404

        buffer = io.BytesIO(plot_bytes)
        buffer.seek(0)
        return send_file(buffer, mimetype="image/png", as_attachment=False)
    except Exception as e:
        return f"Erreur: {str(e)}", 400
