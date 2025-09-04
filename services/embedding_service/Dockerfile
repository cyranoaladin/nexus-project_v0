# Utiliser une image Python officielle comme base
FROM python:3.11-slim

# Définir le répertoire de travail dans le conteneur
WORKDIR /app

# Copier le fichier des dépendances
COPY ./services/embedding_service/requirements.txt .

# Installer les dépendances
# --no-cache-dir pour garder l'image légère
RUN pip install --no-cache-dir -r requirements.txt

# Copier le code de l'application
COPY ./services/embedding_service/main.py .

# Exposer le port que l'application va utiliser
EXPOSE 8000

# La commande pour lancer l'application quand le conteneur démarre
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
