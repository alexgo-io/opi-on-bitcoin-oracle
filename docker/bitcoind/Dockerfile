FROM debian:bullseye-slim

RUN set -ex; \
	apt-get update; \
	apt-get install -y --no-install-recommends \
		gnupg \
		less \
        curl \
        wget \
        ca-certificates \
        git \
	; \
	rm -rf /var/lib/apt/lists/*;

RUN set -eux; \
    curl -L https://bitcoincore.org/bin/bitcoin-core-25.1/bitcoin-25.1-x86_64-linux-gnu.tar.gz -o bitcoin.tar.gz; \
    tar -xzvf bitcoin.tar.gz; \
    install -m 0755 -o root -g root -t /usr/local/bin bitcoin-25.1/bin/*; \
    rm -rf bitcoin.tar.gz bitcoin-25.1; \
    bitcoind --version;

ENV BITCOIN_HOME /usr/local/bitcoind
VOLUME /usr/local/bitcoind
EXPOSE 8332 8333 8334 18543

COPY docker-entrypoint.sh /usr/local/bin/

ENTRYPOINT ["docker-entrypoint.sh"]