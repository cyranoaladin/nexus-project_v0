FROM node@sha256:6c74791e557ce11fc957704f6d4fe134a7bc8d6f5ca4403205b2966bd488f6b3 AS node

FROM ubuntu@sha256:4fbb8e6a8395de5a7550b33509421a2bafbc0aab6c06ba2cef9ebffbc7092d90

ARG DEBIAN_FRONTEND=noninteractive

COPY scripts/pre-rentree/requirements.lock /tmp/requirements.lock
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm

RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm

RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
        fonts-dejavu-core \
        libc6 \
        libcairo2 \
        libfontconfig1 \
        libfreetype6 \
        libglib2.0-0t64 \
        libharfbuzz0b \
        libpango-1.0-0 \
        libpangoft2-1.0-0 \
        libpng16-16t64 \
        poppler-utils \
        python3 \
        python3-venv \
        python3.12 \
        python3.12-venv \
        qpdf \
        zlib1g \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/nexus-pdf \
    && /opt/nexus-pdf/bin/python -m pip install --no-cache-dir \
        -r /tmp/requirements.lock

ENV PATH="/opt/nexus-pdf/bin:${PATH}"

WORKDIR /workspace
