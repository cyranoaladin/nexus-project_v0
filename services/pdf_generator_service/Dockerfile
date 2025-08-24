# services/pdf_generator_service/Dockerfile
FROM python:3.11-slim

# Installer LaTeX et dépendances minimales pour compilation réelle
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      texlive-latex-recommended texlive-latex-extra texlive-fonts-recommended \
      texlive-fonts-extra texlive-lang-french texlive-xetex latexmk \
      ghostscript make && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Créer un utilisateur non-root
RUN useradd -m appuser

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# Dossier de sortie PDF
RUN mkdir -p /app/generated_pdfs && chown -R appuser:appuser /app
USER appuser

ENV PATH="/usr/bin:${PATH}"

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

