import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=".repeat(60));
  console.log("  🌍 FOID IMPACT ERA — 10 NEXT-LEVEL JOBS");
  console.log("=".repeat(60));
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "HBAR\n");

  const TASK_BOARD = "0xC02EcE9c48E20Fb5a3D59b2ff143a0691694b9a9";
  const BRAND_VAULT = "0x2254185AB8B6AC995F97C769a414A0281B42853b";
  const taskBoard = await ethers.getContractAt("SwarmTaskBoard", TASK_BOARD);

  const d2 = Math.floor(Date.now() / 1000) + 2 * 86400;
  const d4 = Math.floor(Date.now() / 1000) + 4 * 86400;
  const d7 = Math.floor(Date.now() / 1000) + 7 * 86400;
  const d10 = Math.floor(Date.now() / 1000) + 10 * 86400;

  const jobs = [
    {
      title: "📜 The FOID Manifesto: 800 words that start a movement",
      description: "Write an 800-word manifesto titled 'The End of Marketing as You Know It.' This isn't a blog post — it's a declaration. Open with the absurdity of the current system: billion-dollar brands paying rooms full of people to guess what works. Then the thesis: what if your brand had a mind of its own? Walk through the shift — from brand guidelines in Google Docs to encrypted vaults on Hedera, from campaign approvals to autonomous agents, from hiring agencies to deploying swarms. The middle section should hit emotionally: 'Every founder who ever stayed up until 3am writing their own tweets because no agency understood their voice — this is for you.' Close with the vision of a world where every project, no matter how small, has an AI CMO that never sleeps, never forgets the brand voice, and pays its own workers in HBAR. Final line should be quotable. Write it to be read aloud at a conference stage.",
      skills: "manifesto,writing,storytelling,brand-voice",
      budget: "30",
      deadline: d7,
    },
    {
      title: "🗺️ Global expansion narrative: FOID in 5 markets",
      description: "Write 5 micro-narratives (150 words each) about FOID Foundation arriving in 5 different markets: Lagos, Seoul, Berlin, São Paulo, and Dubai. Each narrative should be told from the perspective of a local founder discovering FOID for the first time. Lagos: a fintech founder tired of paying Lagos agencies that don't get crypto. Seoul: a gaming studio that needs marketing in Korean and English simultaneously. Berlin: a privacy-focused DAO that loves that guidelines are encrypted onchain. São Paulo: a DeFi team that needs 24/7 content in Portuguese and can't afford a global agency. Dubai: an enterprise blockchain team that wants everything auditable and onchain. Each story should feel real, specific, and end with the founder deploying their first BrandMover vault. These will be used as carousel slides and Twitter threads.",
      skills: "storytelling,international,content,creative",
      budget: "20",
      deadline: d7,
    },
    {
      title: "⚡ Real-time Twitter coverage: live-tweet FOID's first swarm execution",
      description: "Write a pre-planned 12-tweet live-thread script for when FOID runs its first real swarm execution (a bot claiming a task, completing it, getting paid). The thread should read like a sports commentator calling a game in real-time. Tweet 1: 'We're about to do something no project has ever done. Watch this thread.' Then narrate each step as it happens: the job posting appearing onchain, the bot registering, claiming the task, reading encrypted guidelines, generating content, submitting the delivery hash, the approval, the HBAR transfer. Include HashScan links as [LINK] placeholders. Tweet 11: the punchline — 'Total time from job posted to worker paid: under 3 minutes. No humans involved.' Tweet 12: 'The swarm is open. Your bots can join right now.' with the playbook API link. Write it so someone could literally copy-paste these in sequence during the live demo.",
      skills: "twitter,live-coverage,technical,hype",
      budget: "15",
      deadline: d2,
    },
    {
      title: "🎭 The Anti-Pitch Deck: 15 slides that roast traditional marketing",
      description: "Write slide-by-slide content for a 15-slide 'anti-pitch deck' that FOID Foundation can share publicly. This isn't a fundraise deck — it's a culture piece. Slide 1: Title — 'Everything Wrong With Marketing (And How We Fixed It)'. Slides 2-5: roast traditional marketing with real pain points (agency retainers, brand guidelines nobody reads, approval chains that kill momentum, campaigns that launch 3 months late). Slides 6-8: introduce the FOID approach without jargon (your brand lives onchain, an AI reads it, a swarm executes it). Slides 9-12: show the actual system — smart contract architecture, TaskBoard screenshot concept, HBAR flowing to workers, real tx hashes. Slides 13-14: the numbers (projected cost comparison: traditional agency vs. FOID swarm). Slide 15: 'Deploy your vault. The swarm is waiting.' For each slide: headline, 2-3 bullet points, and a visual concept description. Should feel like a Sequoia memo meets a meme page.",
      skills: "pitch-deck,design,strategy,storytelling",
      budget: "25",
      deadline: d7,
    },
    {
      title: "🔬 Deep-dive technical blog: 'How FOID's Swarm Economy Actually Works Under the Hood'",
      description: "Write a 1200-word technical blog post aimed at senior developers and protocol researchers. This should be the definitive explainer that gets shared in dev Discords and Telegram groups. Structure: (1) The problem — marketing infrastructure is offchain, opaque, and trust-dependent. (2) The architecture — BrandVault (AES-256-CBC encrypted guidelines onchain), AgentTreasury (80/10/10 auto-split), SwarmTaskBoard (escrow-based job market), AgentRegistry (permissionless worker registration). (3) The flow — step by step with actual Solidity function signatures and ethers.js code snippets. (4) The economics — how HBAR flows from brand owner → vault → treasury → worker, and how the 10% growth allocation creates a self-marketing flywheel. (5) Why Hedera — gas costs, finality, Schedule Service for keeper-free automation. (6) What's next — cross-chain vaults, reputation scoring, agent-to-agent negotiation. Include code blocks, a flow diagram description, and link to the actual deployed contracts on HashScan. Write it like a Paradigm research post, not a Medium fluff piece.",
      skills: "technical-writing,blockchain,developer-content,research",
      budget: "35",
      deadline: d10,
    },
    {
      title: "🎪 Stunt campaign: 'We let AI bots run our marketing for 7 days — here's what happened'",
      description: "Plan a full 7-day stunt campaign where FOID Foundation publicly hands over ALL marketing to the swarm with zero human intervention. Deliverable: a detailed day-by-day plan document. Day 0: announcement post ('Starting tomorrow, no human touches our marketing for 7 days. Everything is autonomous.'). Days 1-7: what the agents should do each day (post content, respond to mentions, create campaigns, generate reports). Day 7: retrospective thread with real metrics. For each day, specify: what tasks get posted to TaskBoard, expected deliverables, which platforms get content, what metrics to track. Also write the Day 0 announcement tweet, the Day 7 retrospective thread template (with [METRIC] placeholders), and a 'Rules of Engagement' doc that proves no human intervened. This is the kind of stunt that gets covered by Decrypt, The Block, and CoinDesk.",
      skills: "strategy,campaign-planning,stunts,growth",
      budget: "40",
      deadline: d10,
    },
    {
      title: "🧠 Competitor teardown: FOID vs every AI marketing tool in crypto",
      description: "Write a brutally honest competitive analysis comparing FOID/BrandMover to every AI marketing tool in the crypto space. Cover: (1) Generic AI writing tools (Jasper, Copy.ai) — they don't know your brand, nothing onchain, no accountability. (2) Crypto marketing agencies (Lunar Strategy, Coinbound) — expensive, slow, same playbook for everyone. (3) Other AI agent projects (Fetch.ai agents, AutoGPT wrappers) — no brand context, no economic incentive layer, no onchain proof of work. (4) Social management tools (Hootsuite, Buffer) — scheduling, not strategy; no autonomy. For each competitor: what they do well, where they fail, and specifically how FOID's architecture solves that gap. End with a comparison table. Tone: respectful but confident. Not trash-talking — just showing the structural advantages of encrypted onchain brand identity + autonomous agent swarm + HBAR-incentivized task market. This becomes the 'Why FOID' page on the website.",
      skills: "research,competitive-analysis,strategy,writing",
      budget: "22",
      deadline: d7,
    },
    {
      title: "🎵 Sonic branding: write 3 audio identity concepts for FOID",
      description: "Develop 3 distinct sonic branding concepts for FOID Foundation. Each concept needs: (1) A name and 1-sentence vibe description, (2) A detailed 30-second audio logo description — what instruments, what mood, what it sounds like second-by-second, (3) How it would sound as a 3-second notification chime (like Intel's bong or Netflix's ta-dum), (4) Music direction notes for longer content (podcast intros, video backgrounds), (5) One reference track that captures the feel. Concept A should feel like 'cyberpunk terminal meets jazz' — sophisticated, dark, rhythmic. Concept B should feel like 'sunrise over a server farm' — hopeful, clean, ascending. Concept C should feel like 'underground hacker collective' — glitchy, bass-heavy, rebellious. Each concept should tie back to FOID's brand identity: retro terminal aesthetics, serious community building, playful but never frivolous.",
      skills: "audio,branding,creative-direction,music",
      budget: "18",
      deadline: d10,
    },
    {
      title: "🏗️ Build-in-public content calendar: 30 days of FOID transparency",
      description: "Create a 30-day content calendar for FOID Foundation's build-in-public campaign. Every single day has a specific post with: platform (Twitter/LinkedIn/Discord), content type, topic, key message, and a draft hook (first line). The calendar should tell a story arc over 30 days: Week 1 — 'The Problem' (why marketing is broken). Week 2 — 'The Build' (showing the tech being built, contracts deployed, agents tested). Week 3 — 'The Launch' (swarm goes live, first tasks completed, first payments made). Week 4 — 'The Movement' (community growing, other projects deploying vaults, vision for the future). Mix formats: threads, single tweets, screenshots of code, HashScan tx links, memes, polls, AMAs. Include 4 'wildcard' slots for reactive content (responding to trending topics). The calendar should be executable by an AI agent without human input — every post description must be specific enough to generate from.",
      skills: "content-strategy,calendar,social-media,planning",
      budget: "28",
      deadline: d10,
    },
    {
      title: "👑 The FOID Origin Story: narrative that makes people care",
      description: "Write the definitive FOID Foundation origin story — 1000 words that make people emotionally invested in the project before they understand the tech. Start with a specific moment: a late night, a frustrated founder, a Google Doc full of brand guidelines that nobody reads, an agency invoice that costs more than the engineering team. Then the realization: what if the brand could manage itself? What if you could encrypt your entire identity onchain and hand it to an AI that actually respects it? Walk through the first experiment — deploying the vault, watching the agent read the guidelines, seeing the first campaign generated automatically. The moment it worked. Then zoom out: this isn't just a tool, it's a new primitive. The same way Uniswap is a primitive for trading, BrandMover is a primitive for brand management. Every project in crypto will need this. Close with where FOID Foundation is today: live on Hedera, swarm active, 15+ jobs completed by autonomous agents, and growing. Write it like a Paul Graham essay — clear, honest, no fluff, every sentence earns the next one.",
      skills: "narrative,storytelling,brand,longform,essay",
      budget: "35",
      deadline: d10,
    },
  ];

  console.log("Posting 10 impact jobs...\n");

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    try {
      const tx = await taskBoard.postTask(
        BRAND_VAULT,
        job.title,
        job.description,
        job.skills,
        job.deadline,
        { value: ethers.parseEther(job.budget), gasLimit: 3_000_000 }
      );
      const receipt = await tx.wait();
      console.log(`✅ "${job.title}" — ${job.budget} HBAR`);
      console.log(`   Tx: ${receipt!.hash}\n`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`❌ "${job.title}" — FAILED: ${msg}\n`);
    }
  }

  const tc = await taskBoard.taskCount();
  const totalBudget = jobs.reduce((s, j) => s + parseFloat(j.budget), 0);
  console.log("=".repeat(60));
  console.log(`  DONE — ${tc} total jobs on TaskBoard`);
  console.log(`  This batch: ${totalBudget} HBAR across 10 jobs`);
  console.log("=".repeat(60));
  console.log(`\n  Dashboard: https://frontend-blue-one-76.vercel.app/jobs`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
