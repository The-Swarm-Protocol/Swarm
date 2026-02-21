export const HEDERA_RPC_URL = "https://testnet.hashio.io/api";
export const HEDERA_CHAIN_ID = 296;

export const AGENT_TREASURY_ADDRESS = "0x1AC9C959459ED904899a1d52f493e9e4A879a9f4";
export const BRAND_REGISTRY_ADDRESS = "0x76c00C56A60F0a92ED899246Af76c65D835A8EAA";
export const BRAND_VAULT_ADDRESS = "0x2254185AB8B6AC995F97C769a414A0281B42853b";
export const SWARM_TASK_BOARD_ADDRESS = "0x00CBBA3b890F887e67E1a6a9b0CEF7290F0A0634";
export const AGENT_REGISTRY_ADDRESS = "0x557Ac244ad4D4fabc446E37221926Ad8e1F3ce8F";

export const EXPLORER_BASE = "https://hashscan.io/testnet";

export function explorerContract(addr: string) {
  return `${EXPLORER_BASE}/contract/${addr}`;
}

export function explorerTx(hash: string) {
  return `${EXPLORER_BASE}/transaction/${hash}`;
}
