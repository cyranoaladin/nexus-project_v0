FROM node@sha256:6c74791e557ce11fc957704f6d4fe134a7bc8d6f5ca4403205b2966bd488f6b3 AS node

FROM ubuntu@sha256:4fbb8e6a8395de5a7550b33509421a2bafbc0aab6c06ba2cef9ebffbc7092d90

ARG DEBIAN_FRONTEND=noninteractive

COPY scripts/pre-rentree/requirements.lock /tmp/requirements.lock
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm

RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm

RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
        fonts-dejavu-core=2.37-8 \
        libc6=2.39-0ubuntu8.7 \
        libcairo2=1.18.0-3build1 \
        libfontconfig1=2.15.0-1.1ubuntu2 \
        libfreetype6=2.13.2+dfsg-1ubuntu0.1 \
        libglib2.0-0t64=2.80.0-6ubuntu3.8 \
        libharfbuzz0b=8.3.0-2build2 \
        libpango-1.0-0=1.52.1+ds-1build1 \
        libpangoft2-1.0-0=1.52.1+ds-1build1 \
        libpng16-16t64=1.6.43-5ubuntu0.6 \
        poppler-utils=24.02.0-1ubuntu9.9 \
        python3=3.12.3-0ubuntu2.1 \
        python3-venv=3.12.3-0ubuntu2.1 \
        python3.12=3.12.3-1ubuntu0.15 \
        python3.12-venv=3.12.3-1ubuntu0.15 \
        qpdf=11.9.0-1.1ubuntu0.1 \
        zlib1g=1:1.3.dfsg-3.1ubuntu2.1 \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/nexus-pdf \
    && /opt/nexus-pdf/bin/python -m pip install --no-cache-dir \
        -r /tmp/requirements.lock

ENV PATH="/opt/nexus-pdf/bin:${PATH}"

WORKDIR /workspace
