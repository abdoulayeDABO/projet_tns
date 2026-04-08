"""Modèles SQLAlchemy et logique métier audio du projet TNS."""

from __future__ import annotations

from core.database import db
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple
import io
import re
import uuid

import numpy as np
from pydub import AudioSegment
from scipy.fft import fft, fftfreq, ifft
from scipy.io import wavfile
from scipy.signal import resample_poly


class AudioProcessor:
    """Classe principale pour le traitement audio (numérisation, segmentation, FFT, filtrage)."""

    VALID_SAMPLE_RATES = [16000, 22050, 44100]
    VALID_BIT_DEPTHS = [16, 32]

    def __init__(
        self,
        database_root: str = "database",
        segments_root: str = "segments",
        temp_root: str = "temp_uploads",
        filtered_root: str = "filtered_outputs",
    ) -> None:
        """Initialise les dossiers de travail et l'index temporaire.

        Args:
            database_root: Dossier de stockage des enregistrements.
            segments_root: Dossier de stockage des segments.
            temp_root: Dossier des fichiers temporaires d'analyse.
            filtered_root: Dossier des sorties filtrées.
        Returns:
            None
        """
        self.database_root = Path(database_root)
        self.segments_root = Path(segments_root)
        self.temp_root = Path(temp_root)
        self.filtered_root = Path(filtered_root)
        self.temp_index: Dict[str, Dict[str, str]] = {}

        for folder in [self.database_root, self.segments_root, self.temp_root, self.filtered_root]:
            folder.mkdir(parents=True, exist_ok=True)

    def save_recording(self, audio_bytes, sample_rate, bit_depth, locuteur, session, original_filename: str = "audio.wav") -> dict:
        """Sauvegarde un enregistrement dans `database/`.

        Args:
            audio_bytes: Bytes du fichier audio reçu.
            sample_rate: 16000 | 22050 | 44100.
            bit_depth: 16 | 32.
            locuteur: Identifiant du locuteur.
            session: Identifiant de session.
            original_filename: Nom du fichier d'origine pour inférer le format.
        Returns:
            Dictionnaire contenant `success`, `filename`, `path` et métadonnées.
        """
        sample_rate = int(sample_rate)
        bit_depth = int(bit_depth)
        if sample_rate not in self.VALID_SAMPLE_RATES:
            raise ValueError(f"Fréquence invalide: {sample_rate}")
        if bit_depth not in self.VALID_BIT_DEPTHS:
            raise ValueError(f"Codage invalide: {bit_depth}")

        locuteur_clean = self._sanitize_identifier(locuteur, "locuteur_01")
        session_clean = self._sanitize_identifier(session, "session_01")

        wav_bytes = self._ensure_wav_bytes(audio_bytes, original_filename)
        read_sr, data = wavfile.read(io.BytesIO(wav_bytes))
        data = self._to_mono_array(data)

        if int(read_sr) != sample_rate:
            data = self._resample_to_target(data, int(read_sr), sample_rate)

        if bit_depth == 16:
            wav_data = self._float_to_int16(self._to_float32(data))
        else:
            wav_data = self._float_to_int32(self._to_float32(data))

        session_dir = self.database_root / locuteur_clean / session_clean
        session_dir.mkdir(parents=True, exist_ok=True)
        next_idx = self._next_index(session_dir, r"enreg_(\d{3})_.*\.wav")
        sr_label = self._sample_rate_label(sample_rate)
        filename = f"enreg_{next_idx:03d}_{sr_label}_{bit_depth}b.wav"
        output_path = session_dir / filename
        wavfile.write(str(output_path), sample_rate, wav_data)

        return {
            "success": True,
            "filename": filename,
            "path": str(output_path),
            "relative_path": str(output_path.relative_to(Path.cwd())) if output_path.is_absolute() else str(output_path),
            "locuteur": locuteur_clean,
            "session": session_clean,
        }

    def list_audio_files(self) -> List[dict]:
        """Liste tous les fichiers WAV de `database/` avec métadonnées.

        Args:
            None
        Returns:
            Liste de dictionnaires décrivant les fichiers audio.
        """
        files: List[dict] = []
        for wav_path in sorted(self.database_root.rglob("*.wav")):
            rel = wav_path.relative_to(self.database_root)
            parts = rel.parts
            locuteur = parts[0] if len(parts) > 0 else "-"
            session = parts[1] if len(parts) > 1 else "-"
            try:
                sr, data = wavfile.read(str(wav_path))
                duration = round(float(len(data) / float(sr)), 3)
            except Exception:
                duration = 0.0
            files.append(
                {
                    "name": wav_path.name,
                    "relative_path": str(Path("database") / rel),
                    "locuteur": locuteur,
                    "session": session,
                    "size_bytes": wav_path.stat().st_size,
                    "duration": duration,
                }
            )
        return files

    def segment_audio(self, filepath, threshold, min_silence_ms) -> list:
        """Segmente un fichier WAV en retirant les silences.

        Args:
            filepath: Chemin vers le fichier WAV à segmenter.
            threshold: Seuil d'amplitude entre 0 et 1.
            min_silence_ms: Durée minimale de silence en millisecondes.
        Returns:
            Liste de segments avec informations de début, fin, durée et URL.
        """
        threshold = float(threshold)
        min_silence_ms = int(min_silence_ms)
        if threshold < 0 or threshold > 1:
            raise ValueError("Le seuil doit être entre 0 et 1")
        if min_silence_ms <= 0:
            raise ValueError("La durée minimale de silence doit être positive")

        wav_path = Path(filepath)
        if not wav_path.exists():
            raise FileNotFoundError(f"Fichier introuvable: {filepath}")

        sample_rate, raw_data = wavfile.read(str(wav_path))
        signal = self._to_float32(self._to_mono_array(raw_data))
        active_regions = self._detect_active_regions(signal, sample_rate, threshold, min_silence_ms)
        if not active_regions:
            return []

        source_parts = wav_path.parts
        locuteur = source_parts[-3] if len(source_parts) >= 3 else "locuteur_01"
        session = source_parts[-2] if len(source_parts) >= 2 else "session_01"
        rec_stem = wav_path.stem
        seg_dir = self.segments_root / locuteur / session / rec_stem
        seg_dir.mkdir(parents=True, exist_ok=True)

        segments = []
        for idx, (start_idx, end_idx) in enumerate(active_regions, start=1):
            chunk = signal[start_idx:end_idx]
            if len(chunk) == 0:
                continue
            seg_name = f"seg_{idx:03d}.wav"
            out_path = seg_dir / seg_name
            wavfile.write(str(out_path), sample_rate, self._float_to_int16(chunk))

            start_ms = int((start_idx / sample_rate) * 1000)
            end_ms = int((end_idx / sample_rate) * 1000)
            duration_ms = end_ms - start_ms
            segments.append(
                {
                    "filename": seg_name,
                    "start_ms": start_ms,
                    "end_ms": end_ms,
                    "duration_ms": duration_ms,
                    "path": str(out_path),
                    "url": f"/audio/{(Path('segments') / locuteur / session / rec_stem / seg_name).as_posix()}",
                }
            )

        return segments

    def analyze_audio(self, audio_bytes, original_filename) -> dict:
        """Analyse FFT d'un fichier audio avec conversion WAV automatique.

        Args:
            audio_bytes: Bytes du fichier audio envoyé par le client.
            original_filename: Nom du fichier source (pour extension/métadonnées).
        Returns:
            Données d'analyse (temps, amplitude, fréquences, magnitude, file_id).
        """
        wav_bytes = self._ensure_wav_bytes(audio_bytes, original_filename)
        sample_rate, data = wavfile.read(io.BytesIO(wav_bytes))
        channels = 1 if data.ndim == 1 else data.shape[1]
        signal = self._to_float32(self._to_mono_array(data))
        duration = float(len(signal) / float(sample_rate)) if len(signal) else 0.0

        time_axis_full = np.arange(len(signal), dtype=np.float64) / float(sample_rate)
        time_axis, amplitude = self._downsample_pair(time_axis_full, signal, 5000)

        spectrum = fft(signal)
        freqs = fftfreq(len(signal), d=1 / float(sample_rate))
        positive = freqs >= 0
        freq_axis_full = freqs[positive]
        magnitude_db_full = 20 * np.log10(np.abs(spectrum[positive]) + 1e-12)
        freq_axis, fft_magnitude = self._downsample_pair(freq_axis_full, magnitude_db_full, 5000)

        file_id = str(uuid.uuid4())
        temp_path = self.temp_root / f"{file_id}.wav"
        wavfile.write(str(temp_path), int(sample_rate), self._float_to_int16(signal))
        self.temp_index[file_id] = {
            "temp_path": str(temp_path),
            "original_name": original_filename or "audio.wav",
        }

        return {
            "sample_rate": int(sample_rate),
            "duration": round(duration, 4),
            "channels": int(channels),
            "time_axis": time_axis,
            "amplitude": amplitude,
            "freq_axis": freq_axis,
            "fft_magnitude": fft_magnitude,
            "temp_file_id": file_id,
        }

    def apply_filter(self, file_id, fmin, fmax, filter_type) -> dict:
        """Applique un filtre rectangulaire fréquentiel passe-bande/coupe-bande.

        Args:
            file_id: Identifiant de fichier temporaire d'analyse.
            fmin: Fréquence minimale en Hz.
            fmax: Fréquence maximale en Hz.
            filter_type: `passband` ou `stopband`.
        Returns:
            Données filtrées temporelles/spectrales et URL de téléchargement WAV.
        """
        if file_id not in self.temp_index:
            raise FileNotFoundError("Identifiant de fichier temporaire invalide")

        fmin = float(fmin)
        fmax = float(fmax)
        if filter_type not in ["passband", "stopband"]:
            raise ValueError("Type de filtre invalide: passband ou stopband")
        if fmin < 0 or fmax <= 0 or fmin >= fmax:
            raise ValueError("Bornes fréquentielles invalides: 0 <= fmin < fmax")

        temp_path = Path(self.temp_index[file_id]["temp_path"])
        sample_rate, data = wavfile.read(str(temp_path))
        signal = self._to_float32(self._to_mono_array(data))
        nyquist = float(sample_rate) / 2.0
        if fmax > nyquist:
            raise ValueError(f"fmax doit être <= Nyquist ({nyquist:.2f} Hz)")

        x_fft = fft(signal)
        freqs = fftfreq(len(signal), d=1 / float(sample_rate))
        h_pass = ((np.abs(freqs) >= fmin) & (np.abs(freqs) <= fmax)).astype(np.float64)
        h_mask = h_pass if filter_type == "passband" else (1.0 - h_pass)

        x_filtered = x_fft * h_mask
        x_time_filtered = np.real(ifft(x_filtered)).astype(np.float64)

        filtered_name = f"filtered_{file_id}.wav"
        filtered_path = self.filtered_root / filtered_name
        wavfile.write(str(filtered_path), int(sample_rate), self._float_to_int16(x_time_filtered))

        time_axis_full = np.arange(len(x_time_filtered), dtype=np.float64) / float(sample_rate)
        time_axis, amplitude_filtered = self._downsample_pair(time_axis_full, x_time_filtered, 5000)

        spectrum_filtered = fft(x_time_filtered)
        positive = freqs >= 0
        freq_axis_full = freqs[positive]
        mag_filtered_full = 20 * np.log10(np.abs(spectrum_filtered[positive]) + 1e-12)
        freq_axis, fft_magnitude_filtered = self._downsample_pair(freq_axis_full, mag_filtered_full, 5000)

        return {
            "time_axis": time_axis,
            "amplitude_filtered": amplitude_filtered,
            "freq_axis": freq_axis,
            "fft_magnitude_filtered": fft_magnitude_filtered,
            "download_url": f"/download/{filtered_name}",
        }

    def _sanitize_identifier(self, raw_value: str, fallback: str) -> str:
        """Nettoie un identifiant de dossier en ne gardant que `[a-zA-Z0-9_-]`.

        Args:
            raw_value: Valeur brute fournie par le client.
            fallback: Valeur par défaut si la chaîne est vide.
        Returns:
            Identifiant nettoyé et non vide.
        """
        value = (raw_value or "").strip()
        if not value:
            return fallback
        clean = re.sub(r"[^a-zA-Z0-9_-]", "_", value)
        return clean or fallback

    def _sample_rate_label(self, sample_rate: int) -> str:
        """Formate l'étiquette de fréquence pour le nommage de fichier.

        Args:
            sample_rate: Fréquence en Hz.
        Returns:
            Chaîne de type `16kHz`, `22kHz` ou `44kHz`.
        """
        mapping = {16000: "16kHz", 22050: "22kHz", 44100: "44kHz"}
        return mapping.get(int(sample_rate), f"{int(sample_rate // 1000)}kHz")

    def _ensure_wav_bytes(self, audio_bytes: bytes, filename: str = "audio.wav") -> bytes:
        """Convertit un flux audio quelconque vers WAV si nécessaire.

        Args:
            audio_bytes: Contenu binaire du fichier audio.
            filename: Nom du fichier source pour guider le décodage.
        Returns:
            Bytes d'un fichier WAV valide.
        """
        if len(audio_bytes) >= 4 and audio_bytes[:4] in (b"RIFF", b"RIFX", b"RF64"):
            return audio_bytes

        ext = Path(filename or "audio").suffix.replace(".", "") or None
        try:
            audio_segment = AudioSegment.from_file(io.BytesIO(audio_bytes), format=ext)
        except Exception as exc:
            raise ValueError(
                "Format audio non supporté ou fichier invalide."
            ) from exc

        wav_buffer = io.BytesIO()
        audio_segment.export(wav_buffer, format="wav")
        return wav_buffer.getvalue()

    def _to_mono_array(self, data: np.ndarray) -> np.ndarray:
        """Transforme un signal multi-canaux en mono par moyenne.

        Args:
            data: Signal mono ou multi-canaux.
        Returns:
            Tableau mono.
        """
        if data.ndim == 1:
            return data
        return np.mean(data, axis=1)

    def _to_float32(self, data: np.ndarray) -> np.ndarray:
        """Normalise un signal audio vers float32 dans [-1, 1].

        Args:
            data: Signal audio de type entier ou flottant.
        Returns:
            Signal `float32` normalisé.
        """
        if data.dtype == np.int16:
            return (data.astype(np.float32) / 32768.0).astype(np.float32)
        if data.dtype == np.int32:
            return (data.astype(np.float32) / 2147483648.0).astype(np.float32)
        data = data.astype(np.float32)
        max_abs = np.max(np.abs(data)) if len(data) else 1.0
        if max_abs > 1.0:
            data = data / max_abs
        return data

    def _float_to_int16(self, data: np.ndarray) -> np.ndarray:
        """Convertit un signal flottant en `int16` WAV.

        Args:
            data: Signal float.
        Returns:
            Signal `int16` borné.
        """
        data = np.asarray(data, dtype=np.float64)
        max_abs = np.max(np.abs(data)) if len(data) else 1.0
        if max_abs > 1.0:
            data = data / max_abs
        return np.clip(data * 32767.0, -32768, 32767).astype(np.int16)

    def _float_to_int32(self, data: np.ndarray) -> np.ndarray:
        """Convertit un signal flottant en `int32` WAV.

        Args:
            data: Signal float.
        Returns:
            Signal `int32` borné.
        """
        data = np.asarray(data, dtype=np.float64)
        max_abs = np.max(np.abs(data)) if len(data) else 1.0
        if max_abs > 1.0:
            data = data / max_abs
        return np.clip(data * 2147483647.0, -2147483648, 2147483647).astype(np.int32)

    def _resample_to_target(self, data: np.ndarray, src_sr: int, dst_sr: int) -> np.ndarray:
        """Ré-échantillonne un signal mono vers une fréquence cible.

        Args:
            data: Signal source.
            src_sr: Fréquence source.
            dst_sr: Fréquence cible.
        Returns:
            Signal ré-échantillonné.
        """
        float_data = self._to_float32(data)
        return resample_poly(float_data, dst_sr, src_sr).astype(np.float32)

    def _next_index(self, directory: Path, regex_pattern: str) -> int:
        """Retourne le prochain index numérique libre pour un motif donné.

        Args:
            directory: Dossier à inspecter.
            regex_pattern: Motif regex capturant l'index.
        Returns:
            Index incrémental démarrant à 1.
        """
        pattern = re.compile(regex_pattern)
        max_idx = 0
        for file in directory.glob("*.wav"):
            match = pattern.match(file.name)
            if match:
                max_idx = max(max_idx, int(match.group(1)))
        return max_idx + 1

    def _downsample_pair(self, x_data: np.ndarray, y_data: np.ndarray, max_points: int) -> Tuple[List[float], List[float]]:
        """Sous-échantillonne une paire (x, y) pour l'affichage web.

        Args:
            x_data: Axe x.
            y_data: Axe y.
            max_points: Nombre maximal de points conservés.
        Returns:
            Tuple de listes (x, y) adaptées au JSON.
        """
        n = len(x_data)
        if n <= max_points:
            return x_data.tolist(), y_data.tolist()
        step = max(1, n // max_points)
        return x_data[::step].tolist(), y_data[::step].tolist()

    def _detect_active_regions(
        self,
        signal: np.ndarray,
        sample_rate: int,
        threshold: float,
        min_silence_ms: int,
    ) -> List[Tuple[int, int]]:
        """Détecte les régions actives en supprimant les silences longs.

        Args:
            signal: Signal audio mono normalisé.
            sample_rate: Fréquence d'échantillonnage.
            threshold: Seuil d'activité en amplitude absolue.
            min_silence_ms: Durée de silence minimale pour scinder.
        Returns:
            Liste de couples `(start_sample, end_sample)`.
        """
        amplitude = np.abs(signal)
        active = amplitude >= threshold
        if not np.any(active):
            return []

        min_silence_samples = max(1, int(sample_rate * (min_silence_ms / 1000.0)))

        indices = np.flatnonzero(active)
        if len(indices) == 0:
            return []

        chunks: List[Tuple[int, int]] = []
        start = indices[0]
        prev = indices[0]
        for idx in indices[1:]:
            if idx - prev > min_silence_samples:
                chunks.append((int(start), int(prev + 1)))
                start = idx
            prev = idx
        chunks.append((int(start), int(prev + 1)))
        return chunks


class BaseModel(db.Model):
    """Modèle de base avec timestamps."""

    __abstract__ = True

    id = db.Column(db.Integer, primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class RecordingSession(BaseModel):
    """Modèle SQLAlchemy pour une session d'enregistrement."""

    __tablename__ = "recording_sessions"

    locuteur = db.Column(db.String(50), nullable=False, default="locuteur_01")
    session_number = db.Column(db.Integer, nullable=False)
    file_path = db.Column(db.String(255), nullable=False)
    sample_rate = db.Column(db.Integer, nullable=False)
    bit_depth = db.Column(db.Integer, nullable=False)
    duration = db.Column(db.Float, nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(50), default="completed")

    recordings = db.relationship("Recording", backref=db.backref("session", lazy=True), cascade="all, delete-orphan")
    segments = db.relationship("Segment", backref=db.backref("session", lazy=True), cascade="all, delete-orphan")

    def __repr__(self):
        """Retourne la représentation texte du modèle.

        Args:
            None
        Returns:
            Représentation debug de la session.
        """
        return f"<RecordingSession {self.locuteur}/session_{self.session_number:02d}>"


class Recording(BaseModel):
    """Modèle SQLAlchemy pour un enregistrement audio."""

    __tablename__ = "recordings"

    session_id = db.Column(db.Integer, db.ForeignKey("recording_sessions.id"), nullable=False)
    recording_number = db.Column(db.Integer, nullable=False)
    file_path = db.Column(db.String(255), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    sample_rate = db.Column(db.Integer, nullable=False)
    bit_depth = db.Column(db.Integer, nullable=False)
    duration = db.Column(db.Float, nullable=False)
    file_size = db.Column(db.Integer)

    def __repr__(self):
        """Retourne la représentation texte du modèle.

        Args:
            None
        Returns:
            Représentation debug d'un enregistrement.
        """
        return f"<Recording {self.filename}>"


class Segment(BaseModel):
    """Modèle SQLAlchemy pour un segment détecté."""

    __tablename__ = "segments"

    session_id = db.Column(db.Integer, db.ForeignKey("recording_sessions.id"), nullable=False)
    segment_number = db.Column(db.Integer, nullable=False)
    file_path = db.Column(db.String(255), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    start_time = db.Column(db.Float, nullable=False)
    end_time = db.Column(db.Float, nullable=False)
    duration = db.Column(db.Float, nullable=False)
    amplitude_threshold = db.Column(db.Float)
    silence_duration = db.Column(db.Float)

    def __repr__(self):
        """Retourne la représentation texte du modèle.

        Args:
            None
        Returns:
            Représentation debug d'un segment.
        """
        return f"<Segment {self.segment_number}>"
