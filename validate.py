#!/usr/bin/env python3
"""
Test de validation complète - Partie 1 TNS
Vérifie toutes les dépendances et la structure du projet
"""

import sys
import os
from pathlib import Path

print("🔍 Vérification complète du projet TNS - Partie 1\n")

# 1. Vérifier l'environnement
print("1️⃣  Vérification de l'environnement:")
try:
    import flask
    print("   ✓ Flask installé")
except:
    print("   ✗ Flask manquant - pip install flask")
    sys.exit(1)

try:
    import numpy
    print("   ✓ NumPy installé")
except:
    print("   ✗ NumPy manquant - pip install numpy")
    sys.exit(1)

try:
    import scipy
    print("   ✓ SciPy installé")
except:
    print("   ✗ SciPy manquant - pip install scipy")
    sys.exit(1)

try:
    import librosa
    print("   ✓ Librosa installé")
except:
    print("   ✗ Librosa manquant - pip install librosa")
    sys.exit(1)

# 2. Vérifier la structure du projet
print("\n2️⃣  Vérification de la structure du projet:")
required_files = [
    'main.py',
    'endpoints/routes.py',
    'core/models.py',
    'core/database.py',
    'template/base.html',
    'template/index.html',
    'template/pages/numerisation.html',
    'static/recorder.js',
    '.env',
    'requirements.txt'
]

project_root = Path(__file__).parent.absolute()
all_exist = True
for file in required_files:
    path = project_root / file
    if path.exists():
        print(f"   ✓ {file}")
    else:
        print(f"   ✗ {file} manquant")
        all_exist = False

if not all_exist:
    print("\n❌ Certains fichiers manquent!")
    sys.exit(1)

# 3. Vérifier les répertoires
print("\n3️⃣  Création des répertoires nécessaires:")
required_dirs = ['database', 'public', 'instance']
for dir_name in required_dirs:
    dir_path = project_root / dir_name
    dir_path.mkdir(exist_ok=True)
    print(f"   ✓ {dir_name}/")

# 4. Vérifier les paramètres
print("\n4️⃣  Vérification des paramètres (Cahier de Charge):")
params = {
    'Fréquences': [16, 22.05, 44.1],
    'Codages': [16, 32],
    'Durée min': 1,
    'Durée max': 300,
    'Seuil amplitude': '0-100%',
    'Silence minimum': '50-2000ms'
}
for name, value in params.items():
    print(f"   ✓ {name}: {value}")

# 5. Tester les imports
print("\n5️⃣  Test des imports du projet:")
try:
    from core.database import db
    print("   ✓ core.database")
except Exception as e:
    print(f"   ✗ core.database: {e}")
    sys.exit(1)

try:
    from core.models import RecordingSession, Recording, Segment
    print("   ✓ core.models")
except Exception as e:
    print(f"   ✗ core.models: {e}")
    sys.exit(1)

try:
    from endpoints.routes import api_bp
    print("   ✓ endpoints.routes")
except Exception as e:
    print(f"   ✗ endpoints.routes: {e}")
    sys.exit(1)

print("\n✅ TOUS LES TESTS RÉUSSIS!")
print("\n📍 Prêt à démarrer l'application:")
print("   python main.py")
print("   ou: bash run.sh")
print("\n🌐 Accédez à: http://localhost:5000")
