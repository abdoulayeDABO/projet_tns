import os
from pathlib import Path
from dotenv import load_dotenv
from flask import Flask, render_template
from endpoints import api_bp
from core.database import db, init_db

# Charger les variables d'environnement
load_dotenv()

app = Flask(__name__, template_folder='template', instance_path=str(Path(__file__).parent / 'instance'))

# Créer le répertoire instance s'il n'existe pas
os.makedirs(app.instance_path, exist_ok=True)

# Configuration depuis les variables d'environnement
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')
app.config['API_BASE_URL'] = os.getenv('API_BASE_URL', 'http://localhost:5000/api')
app.config['BASE_URL'] = os.getenv('BASE_URL', 'http://localhost:5000')
app.config['AUDIO_STORAGE_DIR'] = os.getenv('AUDIO_STORAGE_DIR', '/tmp/tns_data')

# Configuration de la base de données SQLite
db_path = Path(app.instance_path) / 'tns.db'
DATABASE_URL = f'sqlite:///{db_path}'
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Port depuis les variables d'environnement
PORT = int(os.getenv('PORT', 5000))

# Initialiser la base de données
db.init_app(app)

# Rendre les variables globales disponibles dans les templates
@app.context_processor
def inject_config():
    return {
        'API_BASE_URL': app.config['API_BASE_URL'],
        'BASE_URL': app.config['BASE_URL'],
    }

# Créer les tables au démarrage
with app.app_context():
    db.create_all()

app.register_blueprint(api_bp)


FREQUENCES = [16, 22.05, 44.1]  # en kHz
CODAGE = [16, 32]  # en bits
FORMAT = ["WAV"]
DUREE_MIN = 1  # en secondes
DUREE_MAX = 300  # en secondes

# Paramètres de segmentation
SEUIL_AMPLITUDE_MIN = 0  # %
SEUIL_AMPLITUDE_MAX = 100  # %
SEUIL_AMPLITUDE_DEFAULT = 20  # %
SILENCE_DUREE_MIN = 50  # ms
SILENCE_DUREE_MAX = 2000  # ms
SILENCE_DUREE_DEFAULT = 500  # ms


@app.get("/")
def read_root():
    return render_template('index.html',
        frequences=app.config.get('FREQUENCES', FREQUENCES),
        codages=app.config.get('CODAGE', CODAGE),
        formats=app.config.get('FORMAT', FORMAT),
        seuil_amplitude_min=SEUIL_AMPLITUDE_MIN,
        seuil_amplitude_max=SEUIL_AMPLITUDE_MAX,
        seuil_amplitude_default=SEUIL_AMPLITUDE_DEFAULT,
        silence_duree_min=SILENCE_DUREE_MIN,
        silence_duree_max=SILENCE_DUREE_MAX,
        silence_duree_default=SILENCE_DUREE_DEFAULT
    )


@app.get("/dashboard")
def dashboard():
    return render_template('pages/dashboard.html')


@app.get("/numerisation")
def numerisation():
    return render_template('pages/numerisation.html',
        frequences=app.config.get('FREQUENCES', FREQUENCES),
        codages=app.config.get('CODAGE', CODAGE),
    )


@app.get("/filtrage")
def filtrage():
    return render_template('pages/filtrage.html')


@app.get("/about")
def about():
    return render_template('pages/about.html')


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=PORT, debug=True)
