from core.database import db
from datetime import datetime


class BaseModel(db.Model):
    """Modèle de base avec timestamps"""
    __abstract__ = True
    
    id = db.Column(db.Integer, primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class RecordingSession(BaseModel):
    """Modèle pour une session d'enregistrement"""
    __tablename__ = 'recording_sessions'
    
    locuteur = db.Column(db.String(50), nullable=False, default='locuteur_01')
    session_number = db.Column(db.Integer, nullable=False)
    file_path = db.Column(db.String(255), nullable=False)
    
    # Paramètres d'enregistrement
    sample_rate = db.Column(db.Integer, nullable=False)  # en Hz
    bit_depth = db.Column(db.Integer, nullable=False)  # 16 ou 32 bits
    duration = db.Column(db.Float, nullable=False)  # en secondes
    
    # Métadonnées
    filename = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(50), default='completed')  # completed, processing, error
    
    recordings = db.relationship('Recording', backref=db.backref('session', lazy=True), cascade='all, delete-orphan')
    segments = db.relationship('Segment', backref=db.backref('session', lazy=True), cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<RecordingSession {self.locuteur}/session_{self.session_number:02d}>'


class Recording(BaseModel):
    """Modèle pour un enregistrement audio"""
    __tablename__ = 'recordings'
    
    session_id = db.Column(db.Integer, db.ForeignKey('recording_sessions.id'), nullable=False)
    recording_number = db.Column(db.Integer, nullable=False)
    file_path = db.Column(db.String(255), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    
    # Métadonnées
    sample_rate = db.Column(db.Integer, nullable=False)
    bit_depth = db.Column(db.Integer, nullable=False)
    duration = db.Column(db.Float, nullable=False)
    file_size = db.Column(db.Integer)  # en bytes
    
    def __repr__(self):
        return f'<Recording {self.filename}>'


class Segment(BaseModel):
    """Modèle pour un segment détecté par segmentation"""
    __tablename__ = 'segments'
    
    session_id = db.Column(db.Integer, db.ForeignKey('recording_sessions.id'), nullable=False)
    segment_number = db.Column(db.Integer, nullable=False)
    file_path = db.Column(db.String(255), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    
    # Paramètres de segmentation
    start_time = db.Column(db.Float, nullable=False)  # en secondes
    end_time = db.Column(db.Float, nullable=False)  # en secondes
    duration = db.Column(db.Float, nullable=False)  # en ms
    
    # Métadonnées
    amplitude_threshold = db.Column(db.Float)  # %
    silence_duration = db.Column(db.Float)  # ms
    
    def __repr__(self):
        return f'<Segment {self.segment_number}>'
