import os
from dotenv import load_dotenv
from flask import Flask, render_template
from endpoints import api_bp
from core.database import db, init_db

# Charger les variables d'environnement
load_dotenv()

app = Flask(__name__, template_folder='template')

# Configuration depuis les variables d'environnement
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')
app.config['API_BASE_URL'] = os.getenv('API_BASE_URL', 'http://localhost:8000/api')
app.config['BASE_URL'] = os.getenv('BASE_URL', 'http://localhost:8000')

# Configuration de la base de données SQLite
DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///app.db')
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Port depuis les variables d'environnement
PORT = int(os.getenv('PORT', 8000))

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


@app.get("/")
def read_root():
    return render_template('index.html')


@app.get("/dashboard")
def dashboard():
    return render_template('pages/dashboard.html')


@app.get("/about")
def about():
    return render_template('pages/about.html')


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=PORT, debug=True)
