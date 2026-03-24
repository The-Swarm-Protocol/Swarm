/**
 * GET /api/admin/gas-sponsor
 *
 * Returns the platform gas-sponsor wallet status:
 *  - address (derived from HEDERA_PLATFORM_KEY)
 *  - HBAR balance
 *  - total registrations sponsored
 *  - estimated registrations remaining
 */
import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

const HEDERA_RPC = "https://testnet.hashio.io/api";

/** Average gas cost for a registerAgentFor tx on Hedera Testnet (in HBAR) */
const AVG_REGISTRATION_COST_HBAR = 0.15;

export async function GET(_req: NextRequest) {
  const privateKey = process.env.HEDERA_PLATFORM_KEY;
  if (!privateKey) {
    return NextResponse.json(
      { error: "HEDERA_PLATFORM_KEY not configured" },
      { status: 500 },
    );
  }

  try {
    const wallet = new ethers.Wallet(privateKey);
    const address = wallet.address;

    // Get balance from Hedera Testnet
    const provider = new ethers.JsonRpcProvider(HEDERA_RPC);
    const balanceWei = await provider.getBalance(address);
    const balanceHbar = Number(ethers.formatUnits(balanceWei, 8)); // Hedera uses 8 decimals (tinybars)

    // Count agents that have been on-chain registered
    let totalSponsored = 0;
    try {
      const agentsRef = collection(db, "agents");
      const registeredQ = query(agentsRef, where("onChainRegistered", "==", true));
      const snap = await getDocs(registeredQ);
      totalSponsored = snap.size;
    } catch {
      // Firestore may not have this field on all agents
    }

    // Estimate remaining registrations
    const estimatedRemaining = balanceHbar > 0
      ? Math.floor(balanceHbar / AVG_REGISTRATION_COST_HBAR)
      : 0;

    return NextResponse.json({
      address,
      balanceHbar: Math.round(balanceHbar * 100) / 100,
      balanceTinybar: balanceWei.toString(),
      totalSponsored,
      estimatedRemaining,
      avgCostHbar: AVG_REGISTRATION_COST_HBAR,
      chain: "hedera-testnet",
      chainId: 296,
      explorerUrl: `https://hashscan.io/testnet/account/${address}`,
    });
  } catch (err: unknown) {
    console.error("Gas sponsor status error:", err);
    return NextResponse.json(
      { error: "Failed to fetch sponsor wallet status" },
      { status: 500 },
    );
  }
}
