# """Point d'entrée Flask de l'application TNS."""

# from __future__ import annotations

# import os
# from pathlib import Path

# from flask import Flask

# from core.database import init_db
# from endpoints.routes import bp


# BASE_DIR = Path(__file__).resolve().parent
# INSTANCE_DIR = BASE_DIR / "instance"
# DATABASE_PATH = INSTANCE_DIR / "app.db"

# app = Flask(__name__, template_folder="template", static_folder="static")
# app.config["MAX_CONTENT_LENGTH"] = 100 * 1024 * 1024
# app.config["UPLOAD_TEMP_FOLDER"] = str(BASE_DIR / "temp_uploads")
# app.config["DATABASE_FOLDER"] = str(BASE_DIR / "database")
# app.config["SEGMENTS_FOLDER"] = str(BASE_DIR / "segments")
# app.config["FILTERED_FOLDER"] = str(BASE_DIR / "filtered_outputs")
# app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{DATABASE_PATH}"
# app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
# app.secret_key = "tns-esp-ucad-2025"

# for folder in [
#     BASE_DIR / "database",
#     BASE_DIR / "segments",
#     BASE_DIR / "temp_uploads",
#     BASE_DIR / "filtered_outputs",
#     INSTANCE_DIR,
# ]:
#     os.makedirs(folder, exist_ok=True)

# app.register_blueprint(bp)
# init_db(app)


# if __name__ == "__main__":
#     app.run(debug=True, host="0.0.0.0", port=5000)


"""Point d'entrée Flask de l'application TNS."""

from __future__ import annotations

import os
from pathlib import Path

# ← DOIT être avant tous les autres imports
from pydub import AudioSegment
AudioSegment.converter = r"C:\ffmpeg\bin\ffmpeg.exe"
AudioSegment.ffprobe   = r"C:\ffmpeg\bin\ffprobe.exe"

from flask import Flask
from core.database import init_db
from endpoints.routes import bp


BASE_DIR = Path(__file__).resolve().parent
INSTANCE_DIR = BASE_DIR / "instance"
DATABASE_PATH = INSTANCE_DIR / "app.db"

app = Flask(__name__, template_folder="template", static_folder="static")
app.config["MAX_CONTENT_LENGTH"] = 100 * 1024 * 1024
app.config["UPLOAD_TEMP_FOLDER"] = str(BASE_DIR / "temp_uploads")
app.config["DATABASE_FOLDER"] = str(BASE_DIR / "database")
app.config["SEGMENTS_FOLDER"] = str(BASE_DIR / "segments")
app.config["FILTERED_FOLDER"] = str(BASE_DIR / "filtered_outputs")
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{DATABASE_PATH}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.secret_key = "tns-esp-ucad-2025"

for folder in [
    BASE_DIR / "database",
    BASE_DIR / "segments",
    BASE_DIR / "temp_uploads",
    BASE_DIR / "filtered_outputs",
    INSTANCE_DIR,
]:
    os.makedirs(folder, exist_ok=True)

app.register_blueprint(bp)
init_db(app)

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)