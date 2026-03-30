from core.database import db
from datetime import datetime


class BaseModel(db.Model):
    """Modèle de base avec timestamps"""
    __abstract__ = True
    
    id = db.Column(db.Integer, primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class User(BaseModel):
    """Modèle utilisateur"""
    __tablename__ = 'users'
    
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    
    def __repr__(self):
        return f'<User {self.username}>'


class Item(BaseModel):
    """Modèle élément/produit"""
    __tablename__ = 'items'
    
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text)
    value = db.Column(db.Integer, default=0)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    user = db.relationship('User', backref=db.backref('items', lazy=True))
    
    def __repr__(self):
        return f'<Item {self.name}>'
