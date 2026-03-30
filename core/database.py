import os
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import MetaData

# Configuration de la base de données
naming_convention = {
    "ix": 'ix_%(column_0_label)s',
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s"
}

metadata = MetaData(naming_convention=naming_convention)
db = SQLAlchemy(metadata=metadata)


def init_db(app):
    """Initialiser la base de données avec l'app Flask"""
    db.init_app(app)
    with app.app_context():
        db.create_all()
