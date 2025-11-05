FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    POETRY_VIRTUALENVS_CREATE=0

WORKDIR /app

ARG TECTONIC_VERSION=0.15.0

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        tar \
    && update-ca-certificates \
    && curl -sSL "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/tectonic-${TECTONIC_VERSION}-x86_64-unknown-linux-gnu.tar.gz" -o /tmp/tectonic.tar.gz \
    && mkdir -p /tmp/tectonic-dist \
    && tar -xzf /tmp/tectonic.tar.gz -C /tmp/tectonic-dist \
    && TECTONIC_BIN="$(find /tmp/tectonic-dist -type f -name tectonic -perm -u+x | head -n 1)" \
    && [ -n "$TECTONIC_BIN" ] \
    && install -o root -g root -m 0755 "$TECTONIC_BIN" /usr/local/bin/tectonic \
    && rm -rf /tmp/tectonic* \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./requirements.txt
RUN pip install --upgrade pip \
    && pip install -r requirements.txt

COPY . .

ENV PYTHONPATH=/app

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8088", "--proxy-headers", "--forwarded-allow-ips=*"]
