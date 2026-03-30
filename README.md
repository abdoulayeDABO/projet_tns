# Flask + HTMX + Tailwind CSS - Application Web

Un starter combinant Flask, HTMX et Tailwind CSS avec SQLAlchemy pour la gestion de base de données.

## 🚀 Démarrage Rapide

### Développement Local

1. **Cloner le projet**
```bash
cd /path/to/project
```

2. **Installer les dépendances**
```bash
uv sync
```

3. **Configurer l'environnement**
```bash
# Modifier .env si nécessaire
cat .env
```

4. **Lancer l'application**
```bash
python main.py
```

L'application sera accessible à `http://localhost:8000`

## 🐳 Déploiement avec Docker

### Build et lancer le conteneur

```bash
# Build l'image Docker
docker build -t flask-app .

# Lancer le conteneur
docker run -p 8000:8000 -e SECRET_KEY=your-secret-key flask-app
```

### Avec Docker Compose

```bash
# Lancer l'application complète
docker-compose up -d

# Voir les logs
docker-compose logs -f

# Arrêter l'application
docker-compose down
```

## 📁 Structure du Projet

```
.
├── main.py              # Point d'entrée de l'application
├── asgi.py              # Wrapper ASGI pour Uvicorn
├── Dockerfile           # Configuration Docker multi-stage
├── docker-compose.yml   # Orchestration Docker
├── .dockerignore         # Fichiers à exclure du build Docker
├── .env                 # Variables d'environnement
├── pyproject.toml       # Dépendances du projet
│
├── core/                # Module core
│   ├── __init__.py
│   ├── database.py      # Configuration SQLAlchemy
│   └── models.py        # Modèles de données (User, Item)
│
├── endpoints/           # Routes API
│   ├── __init__.py
│   └── routes.py        # Endpoints HTMX et API
│
├── template/            # Templates Jinja2
│   ├── base.html        # Template de base
│   ├── index.html       # Page d'accueil
│   ├── pages/
│   │   ├── about.html
│   │   └── dashboard.html
│   └── components/
│       ├── alert.html
│       ├── button.html
│       └── card.html
│
├── static/              # Fichiers statiques (CSS, JS, images)
└── public/              # Fichiers publics
```

## 🗄️ Base de Données

### Modèles disponibles

- **User** - Modèle utilisateur
  - username (unique)
  - email (unique)
  - password
  - is_active
  - created_at, updated_at

- **Item** - Modèle élément/produit
  - name
  - description
  - value
  - user_id (clé étrangère)
  - created_at, updated_at

### Initialisation de la BD

La base de données se crée automatiquement au démarrage de l'application.

Pour réinitialiser :
```bash
rm app.db
python main.py
```

## 🌐 Routes Disponibles

- `/` - Page d'accueil
- `/dashboard` - Tableau de bord
- `/about` - À propos
- `/api/data` - Données JSON
- `/api/items/<id>` - Élément spécifique
- `/api/demo` - Démo HTMX
- `/api/activity` - Activité récente
- `/api/greeting` - Message de salutation

## 📊 Variables d'Environnement

```env
FLASK_APP=main.py
FLASK_ENV=development
FLASK_DEBUG=True
PORT=8000
DATABASE_URL=sqlite:///app.db
API_BASE_URL=http://localhost:8000/api
BASE_URL=http://localhost:8000
SECRET_KEY=your-secret-key
```

## 🔧 Technologies

- **Backend** : Flask 3.1+
- **Frontend** : HTMX, Tailwind CSS
- **Database** : SQLAlchemy, SQLite
- **Server** : Gunicorn
- **Containerization** : Docker
- **Package Manager** : UV (uv)

## 📝 Notes

- L'application utilise SQLite par défaut (production : PostgreSQL recommandé)
- Gunicorn avec 4 workers en production
- Health check configuré toutes les 30 secondes
- Image Docker multi-stage optimisée

## 🚢 Production

Pour le déploiement en production :

1. Mettre à jour les variables d'environnement
2. Générer une nouvelle `SECRET_KEY`
3. Configurer une base de données PostgreSQL
4. Utiliser un reverse proxy (Nginx)
5. Activer HTTPS avec Let's Encrypt

## 📞 Support

Pour plus d'informations, consultez la documentation Flask et Tailwind CSS officielles.
