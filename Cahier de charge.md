# 🎙️ Mini-Projet TNS – Numérisation, Segmentation et Filtrage Vocal

> **Cours :** Traitement Numérique du Signal (TNS)  
> **Niveau :** DIC 2 – 4ème année – Génie Informatique  
> **Institution :** École Supérieure Polytechnique (ESP) – UCAD  
> **Enseignant :** Dr. Moustapha MBAYE  
> **Année universitaire :** 2025–2026  
> **Modalité :** Travail en **binôme obligatoire**

---

## 📌 Description

Application web développée en **Python / Flask** permettant le traitement complet d'un signal vocal en deux parties :

- **Partie 1** – Numérisation, enregistrement et segmentation automatique de la voix
- **Partie 2** – Analyse fréquentielle par FFT et filtrage rectangulaire

---

## 🗂️ Structure du Projet

```
project/
├── app.py                  # Point d'entrée Flask
├── requirements.txt        # Dépendances Python
├── templates/
│   ├── index.html          # Interface Partie 1 (Numérisation/Segmentation)
│   └── filtrage.html       # Interface Partie 2 (FFT/Filtrage)
├── static/
│   └── ...                 # CSS, JS, graphiques générés
├── database/               # Base de données audio organisée
│   ├── locuteur_01/
│   │   ├── session_01/
│   │   │   ├── enreg_001_16kHz_16b.wav
│   │   │   └── enreg_002_44kHz_32b.wav
│   │   └── session_02/
│   └── locuteur_02/
└── segments/               # Segments vocaux extraits
```

---

## ⚙️ Installation

### Prérequis

- Python 3.x
- pip

### Dépendances

```bash
pip install flask numpy scipy librosa sounddevice matplotlib pydub
```

Ou via le fichier de dépendances :

```bash
pip install -r requirements.txt
```

### Lancement

```bash
python app.py
```

L'application est accessible à l'adresse : `http://localhost:5000`

---

## 🧩 Partie 1 – Numérisation & Segmentation

### Paramètres d'enregistrement

| Paramètre | Valeurs autorisées |
|---|---|
| Fréquence d'échantillonnage | `16 kHz` · `22,05 kHz` · `44,1 kHz` |
| Codage | `16 bits` · `32 bits` |
| Format de sortie | `WAV` uniquement |
| Durée | Définie librement par l'utilisateur (en secondes) |

> ⚠️ Toute valeur hors tableau est **rejetée** avec un message d'erreur.

### Fonctionnalités

- 🎤 Enregistrement audio depuis le navigateur
- 💾 Sauvegarde structurée en base de données locale (`database/locuteur_XX/session_XX/`)
- ✂️ Segmentation automatique par détection des silences :
  - Seuil d'amplitude configurable
  - Durée minimale de silence configurable (en ms)
- 📋 Liste des segments avec **lecture** et **téléchargement**

### Interface

| Élément | Description |
|---|---|
| Sélecteur de fréquence | Liste déroulante : 16 / 22,05 / 44,1 kHz |
| Codage | Boutons radio : 16 bits / 32 bits |
| Durée | Champ numérique (secondes) |
| Bouton Enregistrer | Lance / arrête la capture microphone |
| Bouton Sauvegarder | Enregistre le fichier `.wav` |
| Seuil + Durée silence | Paramètres de segmentation |
| Bouton Segmenter | Lance le découpage automatique |
| Liste des segments | Tableau avec lecture et téléchargement |

---

## 📊 Partie 2 – Analyse Fréquentielle & Filtrage

### Fonctionnalités

- 📂 Chargement d'un fichier audio (WAV, MP3, OGG…) avec **conversion automatique en WAV**
- 📈 Affichage du signal temporel x(t)
- 📉 Calcul et affichage du spectre d'amplitude par **FFT**
- 🔍 Identification visuelle des zones de bruit sur le spectre

### ⚠️ Contrainte ABSOLUE de filtrage

Le filtrage doit être réalisé **exclusivement par un masque fréquentiel rectangulaire** :

| Type | Description |
|---|---|
| **Passe-bande** | On conserve les fréquences dans `[fmin, fmax]` |
| **Coupe-bande** | On supprime les fréquences dans `[fmin, fmax]` |

> ❌ Tout autre filtre (Butterworth, Hanning, Hamming…) entraîne la note **zéro** sur cette partie.

**Formulation mathématique du masque :**

```
H(f) = 1   si fmin ≤ |f| ≤ fmax   (passe-bande)
       0   sinon

H̄(f) = 1 - H(f)                   (coupe-bande)
```

### Pipeline de traitement

1. Appliquer le masque au spectre FFT
2. Reconstruire le signal par **IFFT**
3. Afficher les spectres et signaux **avant / après** filtrage
4. Écoute du signal filtré dans le navigateur (lecteur HTML5)
5. Téléchargement du fichier WAV filtré

### Interface

| Élément | Description |
|---|---|
| Upload fichier | Chargement + conversion auto en WAV |
| Graphique temporel | Signal x(t) |
| Graphique FFT | Spectre \|X(f)\| |
| fmin et fmax | Bornes du filtre en Hz |
| Type de filtre | Radio : passe-bande / coupe-bande |
| Bouton Filtrer | Applique le masque et reconstruit |
| Comparaison avant/après | Graphiques superposés |
| Lecteur HTML5 | Écoute directe du signal filtré |
| Téléchargement | Export du fichier WAV filtré |

---

## 📦 Bibliothèques utilisées

| Package | Rôle |
|---|---|
| `flask` | Serveur web et routage |
| `numpy` | Calculs numériques et FFT |
| `scipy.fft` | Transformée de Fourier Rapide |
| `scipy.io.wavfile` | Lecture / écriture WAV |
| `librosa` | Segmentation par silence |
| `sounddevice` | Enregistrement microphone |
| `matplotlib` | Génération des graphiques |
| `pydub` | Conversion de formats audio |

---

## 📋 Contraintes Techniques

- ✅ Langage : **Python 3.x uniquement**
- ✅ Framework : **Flask uniquement**
- ✅ Format audio : **WAV** (conversion automatique si besoin)
- ✅ Filtrage : **masque rectangulaire uniquement**
- ✅ **Deux interfaces distinctes** (Partie 1 et Partie 2)
- ✅ Chaque fonction doit avoir une **docstring** (rôle, paramètres, valeur de retour)
- ✅ Travail en **binôme obligatoire**

---

## 📁 Livrables

- [ ] Code source complet, commenté et structuré
- [ ] Application Flask fonctionnelle et testable en local
- [ ] Rapport PDF contenant :
  - Architecture et organisation du code
  - Justification des paramètres de numérisation
  - Analyse commentée des spectres avant/après filtrage
  - Explication du choix des bornes fréquentielles
  - Difficultés rencontrées et solutions apportées
- [ ] Vidéo de démonstration (3–5 min) montrant :
  - Un enregistrement vocal avec paramètres choisis
  - La segmentation automatique
  - L'identification visuelle du bruit sur le spectre FFT
  - L'application du filtre et l'écoute du résultat filtré

---

## 🏆 Grille d'Évaluation

| Critère | Points |
|---|---|
| **Partie 1 – Numérisation / Segmentation** | **/40** |
| Paramètres de numérisation corrects | 10 |
| Enregistrement et sauvegarde WAV | 10 |
| Segmentation automatique fonctionnelle | 10 |
| Organisation de la base de données | 10 |
| **Partie 2 – FFT / Filtrage** | **/40** |
| Chargement et conversion | 5 |
| Affichage du spectre FFT | 10 |
| Filtre rectangulaire correctement appliqué | 15 |
| Reconstruction et export du signal | 10 |
| **Qualité du code et documentation** | **/10** |
| Commentaires, lisibilité, structure | 5 |
| Rapport + vidéo de démonstration | 5 |
| **TOTAL** | **/90** |
| Bonus – originalité de l'interface | +10 |

---

## ⚠️ Consignes Importantes

1. **Binôme obligatoire** – toute soumission individuelle est refusée.
2. **Commenter le code** – chaque fonction doit avoir une docstring.
3. **Justifier les paramètres** – expliquer dans le rapport et la vidéo les choix de fréquence d'échantillonnage, de seuil et de bornes de filtre.
4. **Analyser le spectre dans la vidéo** – montrer le graphique FFT et expliquer visuellement les choix fréquentiels.
5. **Tester sur au moins deux fichiers audio différents.**

> 🚫 **Plagiat :** tout plagiat de code entre binômes ou copie depuis Internet sans adaptation et référence explicite entraîne la note **zéro** pour les deux membres et peut donner lieu à des sanctions disciplinaires.

---

## 📚 Références

- [Flask Documentation](https://flask.palletsprojects.com)
- [SciPy FFT](https://docs.scipy.org/doc/scipy/reference/fft.html)
- [LibROSA](https://librosa.org/doc/latest/index.html)
- [SoundDevice](https://python-sounddevice.readthedocs.io)
- Cours TNS – Dr. Moustapha MBAYE (polycopiés distribués en cours)
- A. V. Oppenheim & R. W. Schafer, *Discrete-Time Signal Processing*, Pearson, 2010.

---

*Dr. Moustapha MBAYE – ESP/UCAD, Département de Génie Informatique – 2025–2026*
