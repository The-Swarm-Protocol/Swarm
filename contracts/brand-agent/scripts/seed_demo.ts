import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=".repeat(60));
  console.log("  SEEDING DEMO DATA — TASKBOARD + CAMPAIGNS");
  console.log("=".repeat(60));
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "HBAR\n");

  // Contracts
  const TASK_BOARD = "0xC02EcE9c48E20Fb5a3D59b2ff143a0691694b9a9";
  const BRAND_VAULT = "0x2254185AB8B6AC995F97C769a414A0281B42853b";

  const taskBoard = await ethers.getContractAt("SwarmTaskBoard", TASK_BOARD);
  const vault = await ethers.getContractAt("BrandVault", BRAND_VAULT);

  const GAS = { gasLimit: 3_000_000 };
  const deadline7d = Math.floor(Date.now() / 1000) + 7 * 86400;
  const deadline3d = Math.floor(Date.now() / 1000) + 3 * 86400;
  const deadline14d = Math.floor(Date.now() / 1000) + 14 * 86400;

  // ============================================================
  // 1. Post Jobs to TaskBoard
  // ============================================================
  console.log("--- 1. Posting Jobs to TaskBoard ---\n");

  const jobs = [
    {
      title: "Write Twitter thread about FOID launch",
      description: "Create a 5-tweet thread announcing FOID Foundation's launch on Hedera. Include key stats, the vision, and a CTA to join Discord. Tone: professional but exciting. Must follow brand guidelines from the vault.",
      skills: "social,twitter,copywriting",
      budget: "10",
      deadline: deadline7d,
    },
    {
      title: "Design Discord welcome banner",
      description: "Design a 1920x1080 welcome banner for the FOID Foundation Discord server. Use brand colors (#00D4AA primary, #1A1A2E secondary). Include logo, tagline, and 'Welcome to the Swarm' text.",
      skills: "design,discord,graphics",
      budget: "5",
      deadline: deadline7d,
    },
    {
      title: "Write press release for BrandMover",
      description: "Draft a 350-word press release about BrandMover: the first autonomous AI CMO on Hedera. Lead with the problem (manual marketing), solution (encrypted onchain brand vault + AI agent), and include a quote from the team. AP style.",
      skills: "content,pr,writing",
      budget: "8",
      deadline: deadline3d,
    },
    {
      title: "Create 30s demo video script",
      description: "Write a script for a 30-second screen-recorded demo video showing: terminal posting a campaign via Telegram bot, HashScan showing the tx, dashboard updating in real-time. Developer-first aesthetic. No hype words.",
      skills: "video,script,content",
      budget: "3",
      deadline: deadline14d,
    },
  ];

  for (const job of jobs) {
    const tx = await taskBoard.postTask(
      BRAND_VAULT,
      job.title,
      job.description,
      job.skills,
      job.deadline,
      { value: ethers.parseEther(job.budget), gasLimit: 3_000_000 }
    );
    const receipt = await tx.wait();
    console.log(`  Posted: "${job.title}" (${job.budget} HBAR)`);
    console.log(`  Tx: ${receipt!.hash}\n`);
  }

  const tc = await taskBoard.taskCount();
  console.log(`TaskBoard now has ${tc} tasks\n`);

  // ============================================================
  // 2. Create Campaigns on BrandVault
  // ============================================================
  console.log("--- 2. Creating Campaigns on BrandVault ---\n");

  const campaigns = [
    {
      name: "FOID Hedera Launch Campaign",
      platforms: "twitter,linkedin,discord",
      type: "full_launch",
      contentTypes: "twitter_thread,linkedin_post,discord_announcement,press_release",
    },
    {
      name: "Swarm Demo Day Promo",
      platforms: "twitter,linkedin",
      type: "social_blitz",
      contentTypes: "twitter_thread,linkedin_post",
    },
  ];

  for (const c of campaigns) {
    const contentHash = ethers.id(c.name + "_" + Date.now());
    const tx = await vault.createCampaign(
      c.name,
      contentHash,
      c.platforms,
      c.type,
      c.contentTypes,
      GAS
    );
    const receipt = await tx.wait();
    console.log(`  Campaign: "${c.name}"`);
    console.log(`  Tx: ${receipt!.hash}\n`);
  }

  // ============================================================
  // 3. Log Agent Activity
  // ============================================================
  console.log("--- 3. Logging Agent Activity ---\n");

  const activities = [
    {
      action: "seed_taskboard",
      description: "Posted 4 demo jobs to SwarmTaskBoard for hackathon demo",
    },
    {
      action: "launch_campaign",
      description: "Launched FOID Hedera Campaign + Swarm Demo Day Promo",
    },
    {
      action: "swarm_ready",
      description: "TaskBoard and AgentRegistry deployed. Swarm is open for worker bots.",
    },
  ];

  for (const a of activities) {
    const dataHash = ethers.id(a.description);
    const tx = await vault.logAgentActivity(a.action, a.description, dataHash, GAS);
    const receipt = await tx.wait();
    console.log(`  Activity: [${a.action}] ${a.description}`);
    console.log(`  Tx: ${receipt!.hash}\n`);
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log("=".repeat(60));
  console.log("  DEMO DATA SEEDED SUCCESSFULLY");
  console.log("=".repeat(60));
  console.log(`\n  TaskBoard: ${tc} jobs posted (${jobs.reduce((s, j) => s + parseFloat(j.budget), 0)} HBAR total budget)`);
  console.log(`  Campaigns: ${campaigns.length} created`);
  console.log(`  Activities: ${activities.length} logged`);
  console.log(`\n  Dashboard: https://frontend-blue-one-76.vercel.app`);
  console.log(`  Jobs page: https://frontend-blue-one-76.vercel.app/jobs`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
