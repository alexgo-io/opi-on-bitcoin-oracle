#!/usr/bin/env bash
set -Eeo pipefail

pushd docker/opi && docker build -t $OPI_IMAGE . && popd;
pushd docker/bitcoind && docker build -t $BITCOIND_IMAGE . && popd;

docker push $OPI_IMAGE;
docker push $BITCOIND_IMAGE;