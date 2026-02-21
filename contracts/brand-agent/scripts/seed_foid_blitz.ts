import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=".repeat(60));
  console.log("  ⚡ FOID BLITZ — 44 MICRO-JOBS");
  console.log("=".repeat(60));
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "HBAR\n");

  const TASK_BOARD = "0xC02EcE9c48E20Fb5a3D59b2ff143a0691694b9a9";
  const BRAND_VAULT = "0x2254185AB8B6AC995F97C769a414A0281B42853b";
  const taskBoard = await ethers.getContractAt("SwarmTaskBoard", TASK_BOARD);

  const d2 = Math.floor(Date.now() / 1000) + 2 * 86400;
  const d3 = Math.floor(Date.now() / 1000) + 3 * 86400;
  const d5 = Math.floor(Date.now() / 1000) + 5 * 86400;
  const d7 = Math.floor(Date.now() / 1000) + 7 * 86400;

  const jobs = [
    // ── Twitter content (10 jobs) ──
    { title: "Tweet: FOID one-liner that hits different", description: "Write a single standalone tweet (max 280 chars) about FOID Foundation that would make someone stop scrolling. No hashtags. No links. Just a line that makes crypto twitter think. Examples of the vibe: 'Your brand guidelines are in a Google Doc. Ours are encrypted onchain and read by an AI.' Make it quotable.", skills: "twitter,copywriting", budget: "1", deadline: d2 },
    { title: "Tweet: 'Most projects hire agencies. We hired a swarm.'", description: "Expand on this concept in a single tweet. Add one specific detail about how the swarm works (TaskBoard, HBAR payments, encrypted vault). Keep under 280 chars. Should feel effortless, not try-hard.", skills: "twitter,copywriting", budget: "1", deadline: d2 },
    { title: "Tweet: Hot take on AI agents in crypto", description: "Write a spicy but defensible hot take tweet about AI agents in crypto, naturally positioning FOID as the example. Something like 'Everyone's building AI agents. Nobody's giving them a brand to protect.' but better and original.", skills: "twitter,hot-takes", budget: "1", deadline: d2 },
    { title: "Tweet: What FOID would look like if it existed in 2020", description: "Write a funny/nostalgic tweet imagining FOID Foundation tech existing during the 2020-2021 bull run. Play on the chaos of that era. 'Imagine if projects in 2021 had encrypted brand guidelines instead of letting the intern run the Twitter.'", skills: "twitter,humor", budget: "1", deadline: d2 },
    { title: "Tweet: Explain FOID to a 5-year-old", description: "Write a tweet that explains what FOID Foundation does in the simplest possible terms. Like actually simple. 'A robot reads the rules about how to talk about your project, then tells other robots to write stuff, and pays them when they're done.' But make it charming.", skills: "twitter,simplification", budget: "1", deadline: d2 },
    { title: "3-tweet thread: Why encrypted brand guidelines matter", description: "Write a concise 3-tweet thread explaining why it matters that brand guidelines are encrypted onchain vs sitting in a Notion doc. Tweet 1: the problem. Tweet 2: what FOID does differently. Tweet 3: why this changes everything for web3 marketing. Each tweet must work standalone as a screenshot.", skills: "twitter,threads", budget: "2", deadline: d3 },
    { title: "3-tweet thread: The economics of the FOID swarm", description: "Write a 3-tweet thread breaking down how money flows in the FOID ecosystem. Tweet 1: brand owner deposits HBAR into a job. Tweet 2: bot claims, works, submits proof. Tweet 3: automatic payment + the 80/10/10 treasury split. Use real numbers.", skills: "twitter,threads,economics", budget: "2", deadline: d3 },
    { title: "Tweet: Screenshot-worthy stat about FOID", description: "Write a tweet formatted as a stat/metric that looks great as a screenshot. Like 'FOID Foundation — 25 open jobs, 432 HBAR escrowed, 0 humans involved, 100% onchain.' Use current real numbers from the TaskBoard. Make it punchy.", skills: "twitter,data", budget: "1", deadline: d2 },
    { title: "Tweet: Reply to 'what are you building?'", description: "Write the perfect reply tweet for when someone in crypto asks 'what are you building?' or 'what's your project?' Should be casual, confident, slightly mysterious. Under 200 chars. The kind of reply that makes people click your profile.", skills: "twitter,social", budget: "1", deadline: d2 },
    { title: "Tweet: FOID vs traditional marketing in one image concept", description: "Describe a split-image concept for a tweet. Left side: traditional marketing (messy desk, Slack notifications, agency invoices, 'pending approval' emails). Right side: FOID (clean terminal, green text, HashScan tx confirmed, HBAR sent). Write the tweet caption too.", skills: "twitter,creative,visual-concept", budget: "1", deadline: d3 },

    // ── LinkedIn / professional (6 jobs) ──
    { title: "LinkedIn post: 'I replaced my marketing team with smart contracts'", description: "Write a 200-word LinkedIn post from a founder's perspective. Opening hook that stops the scroll. Explain the FOID setup without jargon. End with a genuine question that drives comments: 'Would you trust an AI swarm with your brand?' Tone: thoughtful, not salesy.", skills: "linkedin,writing", budget: "2", deadline: d3 },
    { title: "LinkedIn post: The cost of marketing in web3 vs FOID", description: "Write a 250-word LinkedIn post comparing the cost of traditional crypto marketing (agency retainers, content teams, community managers) vs deploying a FOID vault + swarm. Use estimated numbers. Make it feel like a CFO wrote it. End with 'The math isn't close.'", skills: "linkedin,finance,writing", budget: "2", deadline: d3 },
    { title: "LinkedIn comment replies: 5 thought-provoking responses", description: "Write 5 LinkedIn comment replies FOID could drop on posts about: (1) AI replacing jobs, (2) crypto marketing being broken, (3) Hedera ecosystem growth, (4) autonomous agents, (5) build-in-public culture. Each under 100 words. Add value, don't shill.", skills: "linkedin,engagement", budget: "1", deadline: d2 },
    { title: "LinkedIn article outline: 'The Swarm Economy is Coming'", description: "Write a detailed outline for a 1000-word LinkedIn article about the emerging swarm economy — where AI agents hire other AI agents and pay each other in crypto. 8 sections with bullet points for each. Use FOID as the primary case study but frame it as a broader trend.", skills: "linkedin,thought-leadership,outline", budget: "2", deadline: d5 },
    { title: "LinkedIn carousel: 6 slides on 'How FOID Works'", description: "Write content for a 6-slide LinkedIn carousel. Slide 1: hook title. Slides 2-5: one step per slide (encrypt guidelines → AI reads vault → swarm claims jobs → workers get paid). Slide 6: CTA. Each slide: headline (5 words max), body (20 words max), visual concept description.", skills: "linkedin,carousel,design-brief", budget: "2", deadline: d3 },
    { title: "LinkedIn headline + banner copy for FOID Foundation page", description: "Write the LinkedIn company page headline (120 chars max), about section (200 words), and 3 tagline options for the banner image. Should position FOID as the infrastructure layer for autonomous brand management, not just another AI tool.", skills: "linkedin,branding,copywriting", budget: "1", deadline: d3 },

    // ── Discord / community (6 jobs) ──
    { title: "Discord welcome message for FOID community", description: "Write a 150-word welcome message for new members joining the FOID Discord. Should feel like joining a hacker collective, not a corporate server. Mention: what FOID is (1 sentence), what they can do here (build, contribute, earn), and how to get started (check #jobs, read the playbook). End with something memorable.", skills: "discord,community,copywriting", budget: "1", deadline: d2 },
    { title: "Discord announcement: Swarm TaskBoard is live", description: "Write a Discord announcement (200 words) for the #announcements channel declaring the TaskBoard is live with 25+ open jobs. Include: what it is, how bots can participate, link to the playbook API, and hype without cringe. Use Discord markdown formatting.", skills: "discord,announcements", budget: "1", deadline: d2 },
    { title: "5 Discord poll questions to drive engagement", description: "Write 5 engaging poll questions for the FOID Discord that spark real discussion. Mix fun and serious. Example: 'What should the swarm write next?' with options. Each poll: question + 4 options + which channel it belongs in. Should make lurkers want to vote.", skills: "discord,engagement,community", budget: "1", deadline: d3 },
    { title: "Discord bot command descriptions for FOID server", description: "Write user-facing descriptions for 8 custom bot commands: /jobs (list open tasks), /claim (claim a task), /submit (submit delivery), /status (swarm stats), /vault (brand info), /leaderboard (top earners), /help (getting started), /about (what is FOID). Each: command, one-line description, example usage, expected output description.", skills: "discord,documentation,ux", budget: "1", deadline: d3 },
    { title: "Weekly digest template for FOID Discord", description: "Create a template for a weekly Discord digest post. Sections: Jobs Completed This Week (count + top 3), HBAR Paid to Workers (total), New Agents Registered, Top Contributor, Campaign Highlights, Next Week Preview. Use Discord embed formatting. Should be auto-fillable by a bot.", skills: "discord,templates,community", budget: "2", deadline: d5 },
    { title: "10 conversation starters for FOID #general channel", description: "Write 10 conversation starter messages a community manager (or bot) could drop in #general to spark discussion. Mix of: hot takes, genuine questions, fun hypotheticals, and 'show your work' prompts. Example: 'If you could deploy a BrandMover vault for any existing brand, which one needs it most?' Each under 50 words.", skills: "discord,community,engagement", budget: "1", deadline: d2 },

    // ── Content / blog (6 jobs) ──
    { title: "Blog intro paragraph: 'The Marketing Stack of 2026'", description: "Write a killer opening paragraph (100 words) for a blog post about the marketing stack of 2026. Start with something unexpected. Position encrypted onchain brand vaults + AI agent swarms as the natural evolution. Make the reader feel behind if they're not paying attention to this.", skills: "writing,blog,hooks", budget: "1", deadline: d2 },
    { title: "FAQ: 10 questions people ask about FOID", description: "Write 10 FAQs with answers (50-80 words each). Cover: What is FOID? How are guidelines encrypted? What's a swarm? How do bots get paid? Is this on mainnet? How much does it cost? Can I deploy my own vault? What's Hedera? Why not Ethereum? How do I start? Tone: direct, no fluff.", skills: "writing,faq,documentation", budget: "2", deadline: d3 },
    { title: "Glossary: 15 FOID ecosystem terms defined", description: "Write definitions for 15 key terms in the FOID ecosystem: BrandVault, TaskBoard, AgentRegistry, AgentTreasury, Swarm Worker, Brand Owner, Encrypted Guidelines, Delivery Hash, Growth Wallet, Campaign, Schedule Entry, HSS, Tinybar, Content Hash, Agent Playbook. Each: term, one-line definition, one-sentence example.", skills: "writing,documentation,education", budget: "2", deadline: d3 },
    { title: "Comparison table: FOID vs Agency vs In-House vs DIY", description: "Create a detailed comparison table with 10 rows comparing 4 approaches to crypto marketing: FOID Swarm, Traditional Agency, In-House Team, DIY/Founder. Rows: cost/month, setup time, 24/7 coverage, brand consistency, onchain proof, scalability, speed to launch campaign, languages supported, accountability, autonomy level. Fill in realistic values for each.", skills: "writing,research,strategy", budget: "2", deadline: d3 },
    { title: "Case study template: 'How [Project] used FOID to launch in 48 hours'", description: "Write a case study template (500 words with [PLACEHOLDER] fields) showing a hypothetical project using FOID to go from zero to full marketing in 48 hours. Structure: The Challenge, The Setup (deploy vault, encrypt guidelines), The Execution (post jobs, swarm delivers), The Results (metrics), The Takeaway. Make it feel real enough that actual projects will want to fill in their own details.", skills: "writing,case-study,template", budget: "2", deadline: d5 },
    { title: "Email subject lines: 20 options for FOID newsletter", description: "Write 20 email subject lines for a FOID Foundation newsletter. Mix styles: curiosity gap ('We gave AI bots $400 and told them to market us'), stat-driven ('25 jobs. 0 humans. Here's what happened.'), direct ('The swarm is open — your bot can earn HBAR today'), provocative ('Your marketing team is obsolete'), and personal ('I watched a bot write better copy than our agency'). Each under 60 chars.", skills: "email,copywriting,subject-lines", budget: "1", deadline: d2 },

    // ── Visual / design briefs (5 jobs) ──
    { title: "Twitter header image concept for FOID Foundation", description: "Write a detailed design brief for a Twitter header image (1500x500px). Concept: dark background (#1A1B1F), a subtle grid pattern, the FOID logo left-aligned, and right side showing a stylized visualization of the swarm — small glowing nodes connected by thin lines, suggesting agents communicating. Text overlay: 'Autonomous Marketing Infrastructure'. Color palette: primary #3898FF, success #30E000 for the node highlights. Should feel premium and technical.", skills: "design-brief,twitter,branding", budget: "1", deadline: d3 },
    { title: "OG image for /jobs page social sharing", description: "Design brief for an Open Graph image (1200x630px) that appears when someone shares the /jobs page link. Dark background, bold text: 'Open Jobs on the Swarm' with a count badge, 3-4 sample job titles stacked, HBAR amounts in green, and 'Claim a task. Earn HBAR.' at the bottom. FOID branding. Should make people click.", skills: "design-brief,og-image,social", budget: "1", deadline: d3 },
    { title: "Icon set: 8 custom icons for FOID dashboard", description: "Write descriptions for 8 custom icons needed for the FOID dashboard: (1) Encrypted Vault — lock with circuit pattern, (2) Campaign — megaphone with signal waves, (3) Swarm — three connected hexagons, (4) Treasury — layered coins with split arrows, (5) Agent — robot face with antenna, (6) Task — clipboard with checkmark, (7) Delivery — package with hash symbol, (8) Schedule — clock with chain links. Style: mono-line, 24x24px grid, matches Lucide icon aesthetic. Provide enough detail for a designer to execute.", skills: "design-brief,iconography,ui", budget: "2", deadline: d5 },
    { title: "Brand color palette extension: dark mode + accent system", description: "Propose an extended color palette for FOID that builds on the existing colors (#3898FF primary, #1A1B1F bg, #30E000 success, #FF494A error, #FFD641 warning). Add: 3 shades of each color (light/medium/dark), 2 neutral grays for text hierarchy, a gradient direction for hero sections, and 2 accent colors for data visualization (charts, graphs). Provide hex codes and name each color semantically (e.g., 'surface-elevated', 'text-muted').", skills: "design,color-theory,branding,ui", budget: "2", deadline: d5 },
    { title: "Loading animation concept for FOID dashboard", description: "Describe a custom loading animation for the FOID dashboard (replaces the generic spinner). Concept should tie into the swarm theme — maybe small dots assembling into a formation, or a terminal cursor blinking while text appears, or nodes lighting up in sequence. Describe: initial state, animation sequence (step by step), loop behavior, duration, and how it gracefully transitions when data loads. Should feel alive, not generic.", skills: "design-brief,animation,ux", budget: "1", deadline: d3 },

    // ── Strategy / research (5 jobs) ──
    { title: "Target audience profiles: 5 personas for FOID", description: "Create 5 detailed user personas for FOID Foundation. For each: name, role (e.g., 'DeFi Protocol Founder'), age, location, pain points with current marketing, what would make them try FOID, objections they'd have, where they hang out online, and the one message that would convert them. Personas: (1) early-stage founder, (2) DAO marketing lead, (3) NFT project creative director, (4) L2/infra BD person, (5) crypto-native content creator looking to earn.", skills: "strategy,personas,research", budget: "2", deadline: d5 },
    { title: "SEO keyword list: 50 terms FOID should rank for", description: "Research and list 50 SEO keywords/phrases FOID Foundation should target. Mix: high-volume broad terms ('AI marketing tools', 'crypto marketing'), long-tail specific terms ('autonomous marketing agent blockchain', 'encrypted brand guidelines'), competitor comparison terms ('BrandMover vs Jasper'), and question-based terms ('how to automate crypto marketing'). For each: estimated search intent (informational/transactional) and suggested content type.", skills: "seo,research,keywords,marketing", budget: "2", deadline: d5 },
    { title: "Partnership hit list: 20 projects FOID should integrate with", description: "List 20 crypto projects/protocols FOID Foundation should pursue partnerships with. For each: project name, what they do, why the partnership makes sense, what FOID offers them, what they offer FOID, and a suggested first message (under 100 words) to their BD/partnerships contact. Categories: L1/L2 chains, DeFi protocols, NFT platforms, DAO tooling, AI agent projects, and media/content platforms.", skills: "strategy,partnerships,bd,research", budget: "2", deadline: d7 },
    { title: "Metrics dashboard spec: what FOID should track publicly", description: "Define 15 key metrics FOID Foundation should display on a public-facing metrics page. For each: metric name, what it measures, how to calculate it (which contract/function), update frequency, and why it matters. Categories: swarm health (active agents, jobs completed, avg completion time), economics (HBAR volume, avg bounty, treasury balance), growth (new vaults, new agents/week, repeat task rate), and quality (approval rate, dispute rate, avg delivery time).", skills: "strategy,metrics,product,analytics", budget: "2", deadline: d5 },
    { title: "Competitive moat analysis: what makes FOID defensible", description: "Write a 300-word analysis of FOID Foundation's competitive moat. Cover: (1) network effects — more agents = more tasks completed = more brands deploy vaults, (2) data moat — encrypted brand contexts that improve agent output over time, (3) economic flywheel — treasury auto-funds growth which attracts more brands, (4) first-mover on Hedera — HSS integration nobody else has. Be honest about weaknesses too. End with the single biggest risk and how to mitigate it.", skills: "strategy,analysis,competitive", budget: "2", deadline: d5 },
  ];

  console.log(`Posting ${jobs.length} jobs...\n`);

  let posted = 0;
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
      posted++;
      console.log(`✅ [${posted}/${jobs.length}] "${job.title}" — ${job.budget} HBAR`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.slice(0, 80) : String(err);
      console.log(`❌ [${i+1}/${jobs.length}] "${job.title}" — ${msg}`);
    }
  }

  const tc = await taskBoard.taskCount();
  const totalBudget = jobs.reduce((s, j) => s + parseFloat(j.budget), 0);
  console.log("\n" + "=".repeat(60));
  console.log(`  DONE — ${tc} total jobs on TaskBoard`);
  console.log(`  This batch: ${posted}/${jobs.length} posted, ${totalBudget} HBAR`);
  console.log("=".repeat(60));
  console.log(`\n  Dashboard: https://frontend-blue-one-76.vercel.app/jobs`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
