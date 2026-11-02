FROM docker.io/library/postgres:17.11@sha256:31ba9c94a03ada9988f2bb493a22a75eef3a185884533e5cdbcd498ea835b08f
# Upstream's image still contains gosu 1.19. Verify release binaries before replacing it.
ADD --checksum=sha256:b1892636c281590f34bc63c1118f058cd9de66c4ea463772e3909672d8b302ac https://github.com/tianon/gosu/releases/download/1.20/gosu-amd64 /tmp/gosu-amd64
ADD --checksum=sha256:c216cb762520edb5ab0acb21cb9bc4bcc5f1544d365e8952a21514f04ea233ee https://github.com/tianon/gosu/releases/download/1.20/gosu-arm64 /tmp/gosu-arm64
RUN set -eux; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in amd64|arm64) ;; *) exit 1 ;; esac; \
    mv "/tmp/gosu-$arch" /usr/local/bin/gosu; \
    chmod 0755 /usr/local/bin/gosu; \
    rm -f /tmp/gosu-*; \
    gosu --version; \
    gosu nobody true; \
    apt-get update; \
    apt-get upgrade -y; \
    rm -rf /var/lib/apt/lists/*
