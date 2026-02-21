import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=".repeat(60));
  console.log("  🔥 FOID GOES GLOBAL — SEEDING 10 VIRAL JOBS");
  console.log("=".repeat(60));
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "HBAR\n");

  const TASK_BOARD = "0xC02EcE9c48E20Fb5a3D59b2ff143a0691694b9a9";
  const BRAND_VAULT = "0x2254185AB8B6AC995F97C769a414A0281B42853b";
  const taskBoard = await ethers.getContractAt("SwarmTaskBoard", TASK_BOARD);

  const d3 = Math.floor(Date.now() / 1000) + 3 * 86400;
  const d5 = Math.floor(Date.now() / 1000) + 5 * 86400;
  const d7 = Math.floor(Date.now() / 1000) + 7 * 86400;
  const d14 = Math.floor(Date.now() / 1000) + 14 * 86400;

  const jobs = [
    {
      title: "🧵 Twitter mega-thread: FOID Foundation world takeover",
      description: "Write a 10-tweet banger thread telling the story of FOID Foundation going global. Start with 'A quiet project just broke the internet.' Build tension — the encrypted vault, the autonomous agents, the swarm economy. End with 'This isn't a project. It's a movement.' Each tweet must stand alone as a screenshot. Use stats, metaphors, and one controversial take. No cringe hashtags except #FOID.",
      skills: "twitter,copywriting,viral",
      budget: "20",
      deadline: d5,
    },
    {
      title: "🎬 60-second cinematic hype video script",
      description: "Write a script for a 60-second video that opens on a dark terminal screen, green text scrolling. Narrator voice: deep, calm, confident. The script should cover: encrypted brand guidelines living onchain, AI agents that market autonomously, a swarm of bots completing tasks for HBAR, and FOID Foundation as the first project to deploy this at scale. End with the FOID logo glitching into frame and the line: 'The future doesn't need permission.' Include shot descriptions, timing cues, and music mood notes.",
      skills: "video,script,creative,storytelling",
      budget: "25",
      deadline: d7,
    },
    {
      title: "📰 TechCrunch-style press release: FOID Foundation launches autonomous marketing",
      description: "Write a 500-word press release in TechCrunch/Decrypt style announcing FOID Foundation as the first organization to deploy a fully autonomous AI marketing system on Hedera. Lead: problem (marketing is broken, manual, expensive). Paragraph 2: solution (BrandMover — encrypted brand vault + AI agent swarm). Paragraph 3: quote from the team about why this matters. Paragraph 4: technical details (Hedera Schedule Service, TaskBoard smart contracts, agent-to-agent coordination). Paragraph 5: what's next (global expansion, partnerships). AP style. No hype words like 'revolutionary' — let the tech speak.",
      skills: "pr,writing,journalism,content",
      budget: "15",
      deadline: d3,
    },
    {
      title: "🎨 Meme collection: 5 viral memes for FOID x BrandMover",
      description: "Create concepts for 5 memes that crypto twitter would actually share. Each meme needs: (1) image/template description, (2) top text, (3) bottom text, (4) which audience it targets. Ideas to riff on: 'My marketing team is literally bots and they outperform humans', 'POV: your brand guidelines are encrypted onchain and an AI reads them', 'Other projects hire agencies, we hire a swarm', the Drake meme with 'manual marketing' vs 'autonomous AI swarm', and a Galaxy Brain meme escalating from 'hiring a social media manager' to 'deploying self-replicating marketing agents on Hedera'. Make them actually funny, not corporate.",
      skills: "memes,creative,social,humor",
      budget: "8",
      deadline: d3,
    },
    {
      title: "🌍 LinkedIn thought leadership: 'Why FOID Foundation bet everything on autonomous agents'",
      description: "Write a 600-word LinkedIn post from a founder's perspective. Opening hook: a provocative question about the future of marketing. The post should explain why FOID Foundation decided to replace its entire marketing function with an AI agent swarm on Hedera, what that actually means technically (without being boring), and what the results look like. Include 3 specific data points (can be projected/hypothetical but realistic). End with a CTA that makes people want to follow the project. Tone: thoughtful, slightly contrarian, backed by conviction. NOT a sales pitch — a genuine perspective piece.",
      skills: "linkedin,thought-leadership,writing,b2b",
      budget: "12",
      deadline: d5,
    },
    {
      title: "🎙️ Podcast talking points: FOID Foundation on 'Bankless' or 'Unchained'",
      description: "Prepare a briefing doc for a FOID Foundation team member appearing on a top crypto podcast. Include: (1) 3 compelling opening stories/hooks the host could use, (2) 10 likely questions with suggested answers, (3) 3 key soundbites that could go viral as clips, (4) a controversial opinion to drop that will generate Twitter discourse, (5) the one thing listeners should remember. The tone should be casual-smart — like explaining it to a sharp friend at a bar, not presenting to VCs.",
      skills: "podcast,pr,media-prep,strategy",
      budget: "18",
      deadline: d7,
    },
    {
      title: "📊 Infographic: How the FOID Swarm Economy works",
      description: "Design brief for a vertical infographic (1080x2700px, Instagram/Twitter optimized) that explains the FOID swarm economy in 6 steps: (1) Brand owner stores encrypted guidelines onchain, (2) AI agent reads + decrypts guidelines, (3) Agent posts jobs to TaskBoard with HBAR bounties, (4) Worker bots claim tasks and produce content, (5) Deliveries get approved, HBAR flows to workers, (6) Revenue loops back — agent markets itself. Use the brand colors (#3898FF primary, #1A1B1F bg). Each step needs an icon concept, a one-liner, and a 15-word description. Make it clean enough that a non-crypto person could understand it.",
      skills: "design,infographic,visual,data-viz",
      budget: "10",
      deadline: d7,
    },
    {
      title: "🐦 Quote tweet storm: react to 15 trending crypto tweets with FOID angle",
      description: "Find 15 categories of tweets that regularly trend in crypto (e.g., 'AI agents are overhyped', 'What's building on Hedera?', 'Best infra plays for 2026', 'Marketing in web3 is broken', 'Show me your tech stack'). For each, write a quote-tweet response that naturally ties to FOID Foundation without being forced. Each response should: add genuine value to the conversation, include one specific detail about BrandMover/FOID, and feel like it came from someone deep in the space — not a brand account. Max 240 chars per response.",
      skills: "twitter,social,engagement,community",
      budget: "6",
      deadline: d3,
    },
    {
      title: "📧 Email sequence: 3 emails converting devs to deploy BrandMover",
      description: "Write a 3-email drip sequence targeting web3 developers and project founders. Email 1 (Day 0): 'Your marketing is probably costing you 40 hours/month' — pain point + curiosity hook, mention the encrypted vault concept, CTA to read the docs. Email 2 (Day 3): 'Here's what happens when you let an AI swarm run your marketing' — case study style using FOID Foundation data, show the TaskBoard workflow, CTA to try the playbook API. Email 3 (Day 7): 'The code is open. The contracts are live. Deploy in 10 minutes.' — technical walkthrough, link to contracts on HashScan, CTA to deploy their own vault. Each email: subject line, preview text, body (200-300 words), CTA button text.",
      skills: "email,copywriting,developer-marketing,growth",
      budget: "14",
      deadline: d7,
    },
    {
      title: "🏴 Discord community launch kit: channels, roles, bots, welcome flow",
      description: "Design the complete Discord server structure for FOID Foundation's community launch. Include: (1) Channel structure — categories and channels with descriptions and permissions (keep it under 15 channels, no bloat), (2) Role hierarchy — from visitor to core contributor with color codes using brand palette, (3) Welcome message copy — what new members see, max 200 words, (4) 5 bot automation rules (e.g., auto-role on reaction, gm counter, task-feed from TaskBoard), (5) First week engagement plan — 5 activities/events to run in the first 7 days to build momentum. The vibe should feel like joining a hacker collective, not a corporate Slack.",
      skills: "discord,community,strategy,operations",
      budget: "10",
      deadline: d14,
    },
  ];

  console.log("Posting 10 jobs...\n");

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
      console.log(`✅ #${i}: "${job.title}" — ${job.budget} HBAR`);
      console.log(`   Tx: ${receipt!.hash}\n`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`❌ #${i}: "${job.title}" — FAILED: ${msg}\n`);
    }
  }

  const tc = await taskBoard.taskCount();
  console.log("=".repeat(60));
  console.log(`  DONE — TaskBoard now has ${tc} total jobs`);
  console.log("=".repeat(60));
  console.log(`\n  Dashboard: https://frontend-blue-one-76.vercel.app/jobs`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
