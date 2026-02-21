export const HEDERA_RPC_URL = "https://testnet.hashio.io/api";
export const HEDERA_CHAIN_ID = 296;

export const AGENT_TREASURY_ADDRESS = "0x1AC9C959459ED904899a1d52f493e9e4A879a9f4";
export const BRAND_REGISTRY_ADDRESS = "0x76c00C56A60F0a92ED899246Af76c65D835A8EAA";
export const BRAND_VAULT_ADDRESS = "0x2254185AB8B6AC995F97C769a414A0281B42853b";
export const SWARM_TASK_BOARD_ADDRESS = "0xC02EcE9c48E20Fb5a3D59b2ff143a0691694b9a9";
export const AGENT_REGISTRY_ADDRESS = "0x1C56831b3413B916CEa6321e0C113cc19fD250Bd";

export const EXPLORER_BASE = "https://hashscan.io/testnet";

export function explorerContract(addr: string) {
  return `${EXPLORER_BASE}/contract/${addr}`;
}

export function explorerTx(hash: string) {
  return `${EXPLORER_BASE}/transaction/${hash}`;
}
