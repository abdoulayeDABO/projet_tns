"""Routes Flask de l'application TNS (numérisation, segmentation, FFT, filtrage)."""

from __future__ import annotations

from pathlib import Path

from flask import Blueprint, current_app, jsonify, render_template, request, send_file
from werkzeug.utils import secure_filename

from core.models import AudioProcessor

bp = Blueprint("tns", __name__)
api_bp = bp


def get_processor() -> AudioProcessor:
    """Retourne une instance singleton de `AudioProcessor` basée sur la config Flask.

    Args:
        None
    Returns:
        Instance initialisée d'`AudioProcessor`.
    """
    if "audio_processor" not in current_app.extensions:
        current_app.extensions["audio_processor"] = AudioProcessor(
            database_root=current_app.config.get("DATABASE_FOLDER", "database"),
            segments_root=current_app.config.get("SEGMENTS_FOLDER", "segments"),
            temp_root=current_app.config.get("UPLOAD_TEMP_FOLDER", "temp_uploads"),
            filtered_root=current_app.config.get("FILTERED_FOLDER", "filtered_outputs"),
        )
    return current_app.extensions["audio_processor"]


@bp.get("/")
def index() -> str:
    """Affiche la page d'accueil.

    Args:
        None
    Returns:
        HTML rendu de la page index.
    """
    return render_template("index.html", active="home")


@bp.get("/numerisation")
def numerisation() -> str:
    """Affiche la page Numérisation & Segmentation.

    Args:
        None
    Returns:
        HTML rendu de la page `numerisation`.
    """
    return render_template("pages/numerisation.html", active="num")


@bp.get("/filtrage")
def filtrage() -> str:
    """Affiche la page Analyse FFT & Filtrage.

    Args:
        None
    Returns:
        HTML rendu de la page `filtrage`.
    """
    return render_template("pages/filtrage.html", active="fft")


@bp.post("/api/save-recording")
def save_recording():
    """Sauvegarde un enregistrement reçu depuis le navigateur.

    Args:
        Requête multipart avec `audio`, `sample_rate`, `bit_depth`, `locuteur`, `session`.
    Returns:
        JSON `{success, filename, path, ...}` ou erreur.
    """
    processor = get_processor()
    try:
        audio_file = request.files.get("audio")
        if audio_file is None:
            return jsonify({"success": False, "error": "Aucun blob audio reçu"}), 400

        sample_rate = request.form.get("sample_rate", type=int)
        bit_depth = request.form.get("bit_depth", type=int)
        locuteur = request.form.get("locuteur", "locuteur_01")
        session = request.form.get("session", "session_01")

        if sample_rate is None or bit_depth is None:
            return jsonify({"success": False, "error": "sample_rate et bit_depth sont requis"}), 400

        payload = processor.save_recording(
            audio_bytes=audio_file.read(),
            sample_rate=sample_rate,
            bit_depth=bit_depth,
            locuteur=locuteur,
            session=session,
            original_filename=audio_file.filename or "audio.wav",
        )
        return jsonify(payload), 200
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"success": False, "error": f"Erreur interne: {exc}"}), 500


@bp.get("/api/audio-files")
def audio_files():
    """Liste les fichiers WAV de la base audio.

    Args:
        None
    Returns:
        JSON avec la liste des fichiers trouvés.
    """
    processor = get_processor()
    try:
        return jsonify({"success": True, "files": processor.list_audio_files()})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@bp.post("/api/segment")
def segment():
    """Segmente un fichier audio selon un seuil d'amplitude et une durée de silence.

    Args:
        JSON `{filepath, threshold, min_silence_ms}`.
    Returns:
        JSON `{success, segments}` ou erreur.
    """
    processor = get_processor()
    try:
        data = request.get_json(silent=True) or {}
        filepath = data.get("filepath")
        threshold = data.get("threshold", 0.02)
        min_silence_ms = data.get("min_silence_ms", 300)

        if not filepath:
            return jsonify({"success": False, "error": "`filepath` est requis"}), 400

        segments = processor.segment_audio(filepath=filepath, threshold=threshold, min_silence_ms=min_silence_ms)
        return jsonify({"success": True, "segments": segments}), 200
    except (ValueError, FileNotFoundError) as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"success": False, "error": f"Erreur interne: {exc}"}), 500


@bp.post("/api/analyze")
def analyze():
    """Analyse un fichier audio et renvoie les données temporelles/spectrales.

    Args:
        Requête multipart avec `audio`.
    Returns:
        JSON d'analyse incluant `temp_file_id`.
    """
    processor = get_processor()
    try:
        audio_file = request.files.get("audio")
        if audio_file is None:
            return jsonify({"success": False, "error": "Aucun fichier audio reçu"}), 400

        analysis = processor.analyze_audio(
            audio_bytes=audio_file.read(),
            original_filename=audio_file.filename or "audio.wav",
        )
        return jsonify({"success": True, **analysis}), 200
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"success": False, "error": f"Erreur interne: {exc}"}), 500


@bp.post("/api/filter")
def filter_audio():
    """Applique le filtre fréquentiel rectangulaire sur un fichier analysé.

    Args:
        JSON `{file_id, fmin, fmax, filter_type}`.
    Returns:
        JSON des résultats filtrés et `download_url`.
    """
    processor = get_processor()
    try:
        data = request.get_json(silent=True) or {}
        file_id = data.get("file_id")
        fmin = data.get("fmin")
        fmax = data.get("fmax")
        filter_type = data.get("filter_type", "passband")

        if not file_id or fmin is None or fmax is None:
            return jsonify({"success": False, "error": "`file_id`, `fmin`, `fmax` sont requis"}), 400

        result = processor.apply_filter(
            file_id=file_id,
            fmin=fmin,
            fmax=fmax,
            filter_type=filter_type,
        )
        return jsonify({"success": True, **result}), 200
    except (ValueError, FileNotFoundError) as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"success": False, "error": f"Erreur interne: {exc}"}), 500


@bp.get("/audio/<path:filepath>")
def serve_audio(filepath: str):
    """Sert les fichiers audio stockés dans `database/` et `segments/`.

    Args:
        filepath: Chemin relatif cible.
    Returns:
        Fichier audio si accessible, sinon erreur 404.
    """
    cleaned = Path(filepath.strip("/"))
    roots = {
        "database": Path(current_app.config.get("DATABASE_FOLDER", "database")).resolve(),
        "segments": Path(current_app.config.get("SEGMENTS_FOLDER", "segments")).resolve(),
    }

    if cleaned.parts and cleaned.parts[0] in roots:
        root = roots[cleaned.parts[0]]
        candidate = (root / Path(*cleaned.parts[1:])).resolve()
        if str(candidate).startswith(str(root)) and candidate.exists() and candidate.is_file():
            return send_file(candidate, mimetype="audio/wav")
    else:
        for root in roots.values():
            test_path = (root / cleaned).resolve()
            if str(test_path).startswith(str(root)) and test_path.exists() and test_path.is_file():
                return send_file(test_path, mimetype="audio/wav")

    return jsonify({"success": False, "error": "Fichier audio introuvable"}), 404


@bp.get("/download/<filename>")
def download_filtered(filename: str):
    """Télécharge un WAV filtré depuis `filtered_outputs/`.

    Args:
        filename: Nom du fichier filtré.
    Returns:
        Fichier en téléchargement avec `Content-Disposition`.
    """
    filtered_folder = Path(current_app.config.get("FILTERED_FOLDER", "filtered_outputs")).resolve()
    target = (filtered_folder / secure_filename(filename)).resolve()
    if not str(target).startswith(str(filtered_folder)) or not target.exists() or not target.is_file():
        return jsonify({"success": False, "error": "Fichier filtré introuvable"}), 404

    return send_file(
        target,
        as_attachment=True,
        download_name=target.name,
        mimetype="audio/wav",
    )
