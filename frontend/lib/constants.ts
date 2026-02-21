export const HEDERA_RPC_URL = "https://testnet.hashio.io/api";
export const HEDERA_CHAIN_ID = 296;

export const AGENT_TREASURY_ADDRESS = "0x1AC9C959459ED904899a1d52f493e9e4A879a9f4";
export const BRAND_REGISTRY_ADDRESS = "0x76c00C56A60F0a92ED899246Af76c65D835A8EAA";
export const BRAND_VAULT_ADDRESS = "0x2254185AB8B6AC995F97C769a414A0281B42853b";

export const EXPLORER_BASE = "https://hashscan.io/testnet";

export function explorerContract(addr: string) {
  return `${EXPLORER_BASE}/contract/${addr}`;
}

export function explorerTx(hash: string) {
  return `${EXPLORER_BASE}/transaction/${hash}`;
}
