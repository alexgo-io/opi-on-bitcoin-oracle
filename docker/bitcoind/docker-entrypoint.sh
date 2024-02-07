#!/usr/bin/env bash
set -Eeo pipefail

export BITCOIN_RPC_PORT=${BITCOIN_RPC_PORT:-"8332"}
export BITCOIN_ZMQ_PORT=${BITCOIN_ZMQ_PORT:-"18543"}
export BITCOIN_RPC_USER=${BITCOIN_RPC_USER:-"bitcoin"}
export BITCOIN_RPC_PASSWD=${BITCOIN_RPC_PASSWD:-"abcd1234"}
export BITCOIN_DB_CACHE=${BITCOIN_DB_CACHE:-"12000"}

export BITCOIN_HOME="/usr/local/bitcoind"
_main() {
  mkdir -p $BITCOIN_HOME/datadir
  mkdir -p $BITCOIN_HOME/blocksdir

  echo "
  # Generated by https://jlopp.github.io/bitcoin-core-config-generator/
  # [core]
  blocksdir=$BITCOIN_HOME/blocksdir
  datadir=$BITCOIN_HOME/datadir
  dbcache=$BITCOIN_DB_CACHE
  txindex=1
  pid=/bitcoind.pid
  daemon=0

  # [rpc]
  server=1
  rest=1
  rpcuser=$BITCOIN_RPC_USER
  rpcpassword=$BITCOIN_RPC_PASSWD
  rpcport=$BITCOIN_RPC_PORT
  rpcallowip=0.0.0.0/0
  rpcallowip=::/0
  rpcbind=0.0.0.0:$BITCOIN_RPC_PORT

  # [wallet]
  disablewallet=1
  listen=1
  discover=0
  dns=0
  dnsseed=0
  listenonion=0
  rpcserialversion=1
  fallbackfee=0.00001
  rpcthreads=8
  blocksonly=1

  " > /bitcoin.conf

  exec /usr/local/bin/bitcoind -conf=/bitcoin.conf
}

_main "$@"