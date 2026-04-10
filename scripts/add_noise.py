import numpy as np
from scipy.io import wavfile
from pydub import AudioSegment

def ajouter_bruit_tonal(input_file, output_file, freq_bruit=8000, amplitude_bruit=0.1):
    # 1. Lire le fichier original
    audio = AudioSegment.from_file(input_file)
    samplerate = audio.frame_rate
    raw_data = np.array(audio.get_array_of_samples())
    
    # Normalisation pour éviter les distorsions
    if audio.channels == 1:
        data = raw_data.astype(np.float32) / 32768.0
    else:
        data = raw_data.reshape((-1, audio.channels)).astype(np.float32) / 32768.0
    
    # 2. Créer le bruit (un sifflement sinusoïdal)
    duree = len(data) / samplerate
    t = np.linspace(0, duree, len(data), endpoint=False)
    bruit = amplitude_bruit * np.sin(2 * np.pi * freq_bruit * t)
    
    # 3. Ajouter le bruit au signal original
    # (On s'assure que les dimensions correspondent si c'est du stéréo)
    if len(data.shape) > 1:
        signal_bruite = data + bruit[:, np.newaxis]
    else:
        signal_bruite = data + bruit
        
    # 4. Sauvegarder le nouveau fichier
    # On repasse en format 16 bits pour la lecture standard
    signal_final = np.int16(signal_bruite * 32767)
    wavfile.write(output_file, samplerate, signal_final)
    print(f"Fichier bruité créé : {output_file} avec un sifflement à {freq_bruit} Hz")

# Utilisation
ajouter_bruit_tonal("./audio1.mp3", "voix_avec_bruit.wav")