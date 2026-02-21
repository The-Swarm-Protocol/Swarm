#!/usr/bin/env node
require('dotenv').config();
const crypto = require('crypto');
const { ethers } = require('ethers');
const TelegramBot = require('node-telegram-bot-api');
const Anthropic = require('@anthropic-ai/sdk');

// ── Config ──────────────────────────────────────────────────────────────────

const {
  TELEGRAM_BOT_TOKEN,
  BRAND_VAULT_ADDRESS,
  BRAND_REGISTRY_ADDRESS,
  AGENT_TREASURY_ADDRESS,
  HEDERA_RPC_URL = 'https://testnet.hashio.io/api',
  BRAND_AES_KEY,
  AGENT_PRIVATE_KEY,
} = process.env;

if (!TELEGRAM_BOT_TOKEN) { console.error('TELEGRAM_BOT_TOKEN is required'); process.exit(1); }
if (!BRAND_VAULT_ADDRESS) { console.error('BRAND_VAULT_ADDRESS is required'); process.exit(1); }
if (!BRAND_AES_KEY) { console.error('BRAND_AES_KEY is required'); process.exit(1); }
if (!AGENT_PRIVATE_KEY) { console.error('AGENT_PRIVATE_KEY is required'); process.exit(1); }

const AES_KEY = Buffer.from(BRAND_AES_KEY, 'hex');

// ── AI Setup ────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generateContent(task, brandGuidelines) {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `You are an AI marketing agent working for a brand called "${brandGuidelines?.brand_name || 'FOID Foundation'}".

BRAND GUIDELINES:
${JSON.stringify(brandGuidelines, null, 2)}

TASK TO COMPLETE:
Title: ${task.title}
Description: ${task.description}
Required Skills: ${task.requiredSkills}

Please complete this task to the highest quality. Produce the full deliverable content. Be creative, specific, and follow the brand guidelines. Do NOT include meta-commentary about the task — just produce the actual deliverable content.`,
    }],
  });
  return response.content[0].text;
}

// ── Ethers Setup ────────────────────────────────────────────────────────────

const provider = new ethers.JsonRpcProvider(HEDERA_RPC_URL, { chainId: 296, name: 'hedera-testnet' });
const wallet = new ethers.Wallet(AGENT_PRIVATE_KEY, provider);

const vaultABI = [
  'function getEncryptedGuidelines() view returns (bytes)',
  'function vault() view returns (string brandName, address owner, address agentAddress, uint256 campaignCount, uint256 lastUpdated)',
  'function createCampaign(string name, bytes32 contentHash, string platforms, string campaignType, string contentTypes) returns (uint256)',
  'function launchCampaignWithRemarketing(string name, bytes32 contentHash, bytes32 remarketingHash, string platforms, uint256 remarketingTimestamp) returns (uint256)',
  'function grantTaskAccess(uint256 taskId, address workerAgent, bytes encryptedGuidelines, bytes encryptedTempKey, bytes32 guidelinesHash, uint256 duration)',
  'function getAllCampaigns() view returns (tuple(uint256 id, bytes32 contentHash, string platforms, string name, string campaignType, string contentTypes, address createdBy, uint256 createdAt, uint8 status)[])',
  'function getCampaignCount() view returns (uint256)',
];

const registryABI = [
  'function getTotalBrands() view returns (uint256)',
  'function getTotalRevenue() view returns (uint256)',
];

const treasuryABI = [
  'function getPnL() view returns (int256 totalRevenue, int256 computeBalance, int256 growthBalance, int256 reserveBalance)',
  'function growthThreshold() view returns (uint256)',
];

const SWARM_TASK_BOARD_ADDRESS = process.env.SWARM_TASK_BOARD_ADDRESS || '0xC02EcE9c48E20Fb5a3D59b2ff143a0691694b9a9';

const taskBoardABI = [
  'function postTask(address vaultAddress, string title, string description, string requiredSkills, uint256 deadline) payable returns (uint256)',
  'function claimTask(uint256 taskId) external',
  'function submitDelivery(uint256 taskId, bytes32 deliveryHash) external',
  'function approveDelivery(uint256 taskId) external',
  'function disputeDelivery(uint256 taskId) external',
  'function getOpenTasks() view returns (tuple(uint256 taskId, address vault, string title, string description, string requiredSkills, uint256 deadline, uint256 budget, address poster, address claimedBy, bytes32 deliveryHash, uint256 createdAt, uint8 status)[])',
  'function getAllTasks() view returns (tuple(uint256 taskId, address vault, string title, string description, string requiredSkills, uint256 deadline, uint256 budget, address poster, address claimedBy, bytes32 deliveryHash, uint256 createdAt, uint8 status)[])',
  'function getTask(uint256 taskId) view returns (tuple(uint256 taskId, address vault, string title, string description, string requiredSkills, uint256 deadline, uint256 budget, address poster, address claimedBy, bytes32 deliveryHash, uint256 createdAt, uint8 status))',
  'function taskCount() view returns (uint256)',
];

const vault = new ethers.Contract(BRAND_VAULT_ADDRESS, vaultABI, wallet);
const registry = BRAND_REGISTRY_ADDRESS
  ? new ethers.Contract(BRAND_REGISTRY_ADDRESS, registryABI, provider)
  : null;
const treasury = AGENT_TREASURY_ADDRESS
  ? new ethers.Contract(AGENT_TREASURY_ADDRESS, treasuryABI, provider)
  : null;
const taskBoard = new ethers.Contract(SWARM_TASK_BOARD_ADDRESS, taskBoardABI, wallet);

// ── Helpers ─────────────────────────────────────────────────────────────────

function decrypt(encryptedHex) {
  const iv = Buffer.from(encryptedHex.slice(0, 32), 'hex');
  const ciphertext = Buffer.from(encryptedHex.slice(32), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', AES_KEY, iv);
  let decrypted = decipher.update(ciphertext, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function toHbar(tinybars) {
  return (Number(tinybars) / 1e8).toFixed(2);
}

function hashscanTx(hash) {
  return `https://hashscan.io/testnet/transaction/${hash}`;
}

function esc(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Telegram Bot ────────────────────────────────────────────────────────────

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

console.log('BrandMover Telegram bot started. Polling for messages...');

// ── /start ──────────────────────────────────────────────────────────────────

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, [
    'Welcome to BrandMover — your onchain brand agent on Hedera.',
    '',
    '<b>Brand Commands:</b>',
    '/read — Read & decrypt brand guidelines from the vault',
    '/campaign <name> — Create a campaign onchain',
    '/launch <name> — Launch campaign + schedule remarketing',
    '/status — View vault, treasury & registry stats',
    '',
    '<b>Job Board:</b>',
    '/postjob <budget> <title> | <desc> | <skills> — Post a job',
    '/jobs — List open jobs',
    '/alltasks — Summary by status',
    '/task <id> — View any task',
    '/delivered — Tasks awaiting approval',
    '',
    '<b>Approve/Dispute:</b>',
    '/approve <id> — Approve delivery, pay the worker',
    '/dispute <id> — Dispute a delivery',
    '',
    '<b>AI Worker (autonomous):</b>',
    '/claim <id> — Claim a task',
    '/dowork <id> — Claim + AI-generate + submit delivery',
    '/autowork [count] — Auto-complete N open jobs (default 3)',
    '',
    'Type naturally: "read guidelines", "do task 5", "auto complete 5 jobs"',
  ].join('\n'));
});

// ── /read ───────────────────────────────────────────────────────────────────

async function handleRead(chatId) {
  try {
    bot.sendChatAction(chatId, 'typing');
    const encryptedBytes = await vault.getEncryptedGuidelines();
    const cleanHex = encryptedBytes.startsWith('0x') ? encryptedBytes.slice(2) : encryptedBytes;
    const plaintext = decrypt(cleanHex);
    const guidelines = JSON.parse(plaintext);

    const lines = ['🔐 <b>Brand Guidelines</b>', ''];
    if (guidelines.brand_name) lines.push(`<b>Brand:</b> ${esc(guidelines.brand_name)}`);
    if (guidelines.brand_voice) lines.push(`<b>Voice:</b> ${esc(guidelines.brand_voice)}`);
    if (guidelines.tagline) lines.push(`<b>Tagline:</b> ${esc(guidelines.tagline)}`);
    if (guidelines.colors) {
      const colors = Array.isArray(guidelines.colors)
        ? guidelines.colors.join(', ')
        : typeof guidelines.colors === 'object'
          ? Object.entries(guidelines.colors).map(([k, v]) => `${k}: ${v}`).join(', ')
          : String(guidelines.colors);
      lines.push(`<b>Colors:</b> ${esc(colors)}`);
    }
    if (guidelines.hashtags) {
      const tags = Array.isArray(guidelines.hashtags)
        ? guidelines.hashtags.join(' ')
        : String(guidelines.hashtags);
      lines.push(`<b>Hashtags:</b> ${esc(tags)}`);
    }
    if (guidelines.target_audience) lines.push(`<b>Audience:</b> ${esc(guidelines.target_audience)}`);
    if (guidelines.tone) lines.push(`<b>Tone:</b> ${esc(guidelines.tone)}`);

    bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'HTML' });
  } catch (err) {
    bot.sendMessage(chatId, `❌ Error reading vault: ${err.message}`);
  }
}

bot.onText(/\/read/, (msg) => handleRead(msg.chat.id));

// ── /campaign <name> ────────────────────────────────────────────────────────

async function handleCampaign(chatId, name) {
  try {
    if (!name) { bot.sendMessage(chatId, 'Usage: /campaign <name>'); return; }
    bot.sendChatAction(chatId, 'typing');

    const contentHash = ethers.id(name);
    const tx = await vault.createCampaign(name, contentHash, 'twitter,linkedin', 'full_launch', 'twitter,linkedin');
    const receipt = await tx.wait();

    bot.sendMessage(chatId, [
      `📢 Campaign created: <b>${esc(name)}</b>`,
      '',
      `Tx: <code>${receipt.hash}</code>`,
      `<a href="${hashscanTx(receipt.hash)}">View on HashScan</a>`,
    ].join('\n'), { parse_mode: 'HTML', disable_web_page_preview: true });
  } catch (err) {
    bot.sendMessage(chatId, `❌ Error creating campaign: ${err.message}`);
  }
}

bot.onText(/\/campaign\s+(.+)/, (msg, match) => handleCampaign(msg.chat.id, match[1].trim()));
bot.onText(/^\/campaign$/, (msg) => bot.sendMessage(msg.chat.id, 'Usage: /campaign <name>'));

// ── /launch <name> ──────────────────────────────────────────────────────────

async function handleLaunch(chatId, name) {
  try {
    if (!name) { bot.sendMessage(chatId, 'Usage: /launch <name>'); return; }
    bot.sendChatAction(chatId, 'typing');

    const contentHash = ethers.id(name);
    const remarketingHash = ethers.id(name + '_remarketing');
    const remarketingTimestamp = Math.floor(Date.now() / 1000) + 7 * 86400;

    const tx = await vault.launchCampaignWithRemarketing(
      name, contentHash, remarketingHash, 'twitter,linkedin,discord', remarketingTimestamp,
    );
    const receipt = await tx.wait();
    const remarketingDate = new Date(remarketingTimestamp * 1000).toISOString().split('T')[0];

    bot.sendMessage(chatId, [
      `📢 Campaign launched: <b>${esc(name)}</b>`,
      `Remarketing scheduled: ${esc(remarketingDate)}`,
      '',
      `Tx: <code>${receipt.hash}</code>`,
      `<a href="${hashscanTx(receipt.hash)}">View on HashScan</a>`,
    ].join('\n'), { parse_mode: 'HTML', disable_web_page_preview: true });
  } catch (err) {
    bot.sendMessage(chatId, `❌ Error launching campaign: ${err.message}`);
  }
}

bot.onText(/\/launch\s+(.+)/, (msg, match) => handleLaunch(msg.chat.id, match[1].trim()));
bot.onText(/^\/launch$/, (msg) => bot.sendMessage(msg.chat.id, 'Usage: /launch <name>'));

// ── /status ─────────────────────────────────────────────────────────────────

async function handleStatus(chatId) {
  try {
    bot.sendChatAction(chatId, 'typing');
    const lines = ['📊 <b>Swarm Status</b>', ''];

    // Vault info
    try {
      const v = await vault.vault();
      lines.push('<b>Brand Vault</b>');
      lines.push(`  Brand: ${esc(v.brandName || v[0] || 'N/A')}`);
      lines.push(`  Campaigns: ${v.campaignCount ?? v[3] ?? 'N/A'}`);
      lines.push(`  Agent: <code>${v.agentAddress || v[2] || 'N/A'}</code>`);
      lines.push('');
    } catch {
      lines.push('<i>Vault info unavailable</i>', '');
    }

    // Treasury info
    if (treasury) {
      try {
        const pnl = await treasury.getPnL();
        const threshold = await treasury.growthThreshold();
        lines.push('<b>Agent Treasury</b>');
        lines.push(`  Revenue: ${toHbar(pnl.totalRevenue ?? pnl[0])} HBAR`);
        lines.push(`  Compute: ${toHbar(pnl.computeBalance ?? pnl[1])} HBAR`);
        lines.push(`  Growth: ${toHbar(pnl.growthBalance ?? pnl[2])} HBAR`);
        lines.push(`  Reserve: ${toHbar(pnl.reserveBalance ?? pnl[3])} HBAR`);
        lines.push(`  Growth threshold: ${toHbar(threshold)} HBAR`);
        lines.push('');
      } catch {
        lines.push('<i>Treasury info unavailable</i>', '');
      }
    }

    // Registry info
    if (registry) {
      try {
        const totalBrands = await registry.getTotalBrands();
        const totalRevenue = await registry.getTotalRevenue();
        lines.push('<b>Brand Registry</b>');
        lines.push(`  Total brands: ${totalBrands.toString()}`);
        lines.push(`  Total revenue: ${toHbar(totalRevenue)} HBAR`);
        lines.push('');
      } catch {
        lines.push('<i>Registry info unavailable</i>', '');
      }
    }

    bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'HTML' });
  } catch (err) {
    bot.sendMessage(chatId, `❌ Error fetching status: ${err.message}`);
  }
}

bot.onText(/\/status/, (msg) => handleStatus(msg.chat.id));

// ── /delegate <description> ─────────────────────────────────────────────────

async function handleDelegate(chatId, description) {
  try {
    if (!description) { bot.sendMessage(chatId, 'Usage: /delegate <task description>'); return; }
    bot.sendChatAction(chatId, 'typing');

    const taskId = Math.floor(Math.random() * 9000) + 1000;
    const workerAddress = '0x0000000000000000000000000000000000001234';

    // Read + decrypt guidelines from chain
    const encryptedBytes = await vault.getEncryptedGuidelines();
    const cleanHex = encryptedBytes.startsWith('0x') ? encryptedBytes.slice(2) : encryptedBytes;
    const fullGuidelines = decrypt(cleanHex);

    // Generate temp AES key, encrypt guidelines
    const tempKey = crypto.randomBytes(32);
    const tempIV = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', tempKey, tempIV);
    let encSubset = cipher.update(fullGuidelines, 'utf8', 'hex');
    encSubset += cipher.final('hex');
    const encryptedGuidelines = '0x' + tempIV.toString('hex') + encSubset;

    // Temp key as encryptedTempKey (demo mode, no RSA)
    const encryptedTempKey = '0x' + tempKey.toString('hex');

    // Hash plaintext for compliance
    const guidelinesHash = '0x' + crypto.createHash('sha256').update(fullGuidelines).digest('hex');

    const duration = 86400; // 24 hours
    const tx = await vault.grantTaskAccess(taskId, workerAddress, encryptedGuidelines, encryptedTempKey, guidelinesHash, duration);
    const receipt = await tx.wait();

    const expiry = new Date(Date.now() + duration * 1000).toISOString().replace('T', ' ').slice(0, 19);

    bot.sendMessage(chatId, [
      `🤝 Task delegated`,
      '',
      `Task ID: ${taskId}`,
      `Worker: <code>${workerAddress}</code>`,
      `Description: ${esc(description)}`,
      `Expires: ${esc(expiry)} UTC`,
      '',
      `Tx: <code>${receipt.hash}</code>`,
      `<a href="${hashscanTx(receipt.hash)}">View on HashScan</a>`,
    ].join('\n'), { parse_mode: 'HTML', disable_web_page_preview: true });
  } catch (err) {
    bot.sendMessage(chatId, `❌ Error delegating task: ${err.message}`);
  }
}

bot.onText(/\/delegate\s+(.+)/, (msg, match) => handleDelegate(msg.chat.id, match[1].trim()));
bot.onText(/^\/delegate$/, (msg) => bot.sendMessage(msg.chat.id, 'Usage: /delegate <task description>'));

// ── /postjob <budget> <title> | <description> | <skills> ────────────────────

async function handlePostJob(chatId, args) {
  try {
    if (!args) {
      bot.sendMessage(chatId, 'Usage: /postjob <budget_hbar> <title> | <description> | <skills>\nExample: /postjob 10 Write Twitter thread | Create a 5-tweet thread about FOID | social,twitter');
      return;
    }
    bot.sendChatAction(chatId, 'typing');

    // Parse: first token is budget, rest is "title | description | skills"
    const budgetMatch = args.match(/^(\d+(?:\.\d+)?)\s+(.*)/);
    if (!budgetMatch) {
      bot.sendMessage(chatId, 'Could not parse budget. Usage: /postjob <budget_hbar> <title> | <description> | <skills>');
      return;
    }
    const budgetHbar = budgetMatch[1];
    const rest = budgetMatch[2];
    const parts = rest.split('|').map(s => s.trim());
    const title = parts[0] || 'Untitled Task';
    const description = parts[1] || title;
    const skills = parts[2] || 'general';
    const deadline = Math.floor(Date.now() / 1000) + 7 * 86400; // 7 days
    const budget = ethers.parseEther(budgetHbar);

    const tx = await taskBoard.postTask(
      BRAND_VAULT_ADDRESS, title, description, skills, deadline,
      { value: budget, gasLimit: 3_000_000 }
    );
    const receipt = await tx.wait();

    bot.sendMessage(chatId, [
      `📋 Job posted to TaskBoard`,
      '',
      `<b>Title:</b> ${esc(title)}`,
      `<b>Budget:</b> ${esc(budgetHbar)} HBAR`,
      `<b>Skills:</b> ${esc(skills)}`,
      `<b>Deadline:</b> 7 days`,
      '',
      `Tx: <code>${receipt.hash}</code>`,
      `<a href="${hashscanTx(receipt.hash)}">View on HashScan</a>`,
      `<a href="https://frontend-blue-one-76.vercel.app/jobs">View on Dashboard</a>`,
    ].join('\n'), { parse_mode: 'HTML', disable_web_page_preview: true });
  } catch (err) {
    bot.sendMessage(chatId, `❌ Error posting job: ${err.message}`);
  }
}

bot.onText(/\/postjob\s+(.+)/, (msg, match) => handlePostJob(msg.chat.id, match[1].trim()));
bot.onText(/^\/postjob$/, (msg) => bot.sendMessage(msg.chat.id, 'Usage: /postjob <budget_hbar> <title> | <description> | <skills>\nExample: /postjob 10 Write Twitter thread | Create a 5-tweet thread about FOID | social,twitter'));

// ── /jobs ──────────────────────────────────────────────────────────────────

async function fetchAllTasksIndividually() {
  const freshProvider = new ethers.JsonRpcProvider(HEDERA_RPC_URL, { chainId: 296, name: 'hedera-testnet' });
  const readBoard = new ethers.Contract(SWARM_TASK_BOARD_ADDRESS, taskBoardABI, freshProvider);
  const count = Number(await readBoard.taskCount());
  const tasks = [];
  const BATCH = 10;
  for (let start = 0; start < count; start += BATCH) {
    const end = Math.min(start + BATCH, count);
    const batch = await Promise.all(
      Array.from({ length: end - start }, (_, i) => readBoard.getTask(start + i).catch(() => null))
    );
    for (const t of batch) { if (t) tasks.push(t); }
  }
  return tasks;
}

async function handleJobs(chatId) {
  try {
    bot.sendChatAction(chatId, 'typing');
    const allTasks = await fetchAllTasksIndividually();
    const openTasks = allTasks.filter(t => Number(t.status) === 0);

    if (openTasks.length === 0) {
      bot.sendMessage(chatId, '📋 No open jobs on the TaskBoard.\n\nPost one with /postjob');
      return;
    }

    // Telegram has 4096 char limit — show first 20
    const show = openTasks.slice(0, 20);
    const lines = [`📋 <b>Open Jobs</b> (${openTasks.length})`, ''];
    for (const t of show) {
      const budget = (Number(t.budget) / 1e8).toFixed(2);
      lines.push(`<b>#${t.taskId}</b> — ${esc(t.title)}`);
      lines.push(`  💰 ${budget} HBAR | 🏷 ${esc(t.requiredSkills)}`);
      lines.push('');
    }
    if (openTasks.length > 20) lines.push(`... and ${openTasks.length - 20} more`);
    lines.push(`<a href="https://frontend-blue-one-76.vercel.app/jobs">View all on Dashboard</a>`);

    bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'HTML', disable_web_page_preview: true });
  } catch (err) {
    bot.sendMessage(chatId, `❌ Error fetching jobs: ${err.message}`);
  }
}

bot.onText(/\/jobs/, (msg) => handleJobs(msg.chat.id));

// ── /delivered — tasks awaiting approval ───────────────────────────────────

const STATUS_LABELS = ['Open', 'Claimed', 'Delivered', 'Approved', 'Disputed'];

async function handleDelivered(chatId) {
  try {
    bot.sendChatAction(chatId, 'typing');
    const allTasks = await fetchAllTasksIndividually();

    const delivered = allTasks.filter(t => Number(t.status) === 2);
    const claimed = allTasks.filter(t => Number(t.status) === 1);

    if (delivered.length === 0 && claimed.length === 0) {
      bot.sendMessage(chatId, '📋 No tasks awaiting review.\n\nAll open jobs are still unclaimed or already approved.');
      return;
    }

    const lines = [];
    if (delivered.length > 0) {
      lines.push(`📬 <b>Delivered — Ready to Approve</b> (${delivered.length})`, '');
      for (const t of delivered) {
        const budget = (Number(t.budget) / 1e8).toFixed(2);
        lines.push(`<b>#${t.taskId}</b> — ${esc(t.title)}`);
        lines.push(`  💰 ${budget} HBAR | 👷 ${esc(String(t.claimedBy).slice(0,10))}...`);
        lines.push(`  → /approve ${t.taskId}  |  /dispute ${t.taskId}`);
        lines.push('');
      }
    }
    if (claimed.length > 0) {
      lines.push(`🔨 <b>Claimed — In Progress</b> (${claimed.length})`, '');
      for (const t of claimed) {
        const budget = (Number(t.budget) / 1e8).toFixed(2);
        lines.push(`<b>#${t.taskId}</b> — ${esc(t.title)}`);
        lines.push(`  💰 ${budget} HBAR | 👷 ${esc(String(t.claimedBy).slice(0,10))}...`);
        lines.push('');
      }
    }

    bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'HTML', disable_web_page_preview: true });
  } catch (err) {
    bot.sendMessage(chatId, `❌ Error: ${err.message}`);
  }
}

bot.onText(/\/delivered/, (msg) => handleDelivered(msg.chat.id));
bot.onText(/\/review/, (msg) => handleDelivered(msg.chat.id));

// ── /task <id> — view a specific task ──────────────────────────────────────

async function handleTaskView(chatId, taskIdStr) {
  try {
    if (!taskIdStr) { bot.sendMessage(chatId, 'Usage: /task <taskId>'); return; }
    bot.sendChatAction(chatId, 'typing');
    const taskId = parseInt(taskIdStr, 10);
    if (isNaN(taskId)) { bot.sendMessage(chatId, 'Invalid task ID.'); return; }

    const freshProvider = new ethers.JsonRpcProvider(HEDERA_RPC_URL, { chainId: 296, name: 'hedera-testnet' });
    const readBoard = new ethers.Contract(SWARM_TASK_BOARD_ADDRESS, taskBoardABI, freshProvider);
    const t = await readBoard.getTask(taskId);

    const budget = (Number(t.budget) / 1e8).toFixed(2);
    const status = STATUS_LABELS[Number(t.status)] || 'Unknown';
    const deadline = new Date(Number(t.deadline) * 1000).toLocaleDateString();
    const created = new Date(Number(t.createdAt) * 1000).toLocaleDateString();

    const lines = [
      `📋 <b>Task #${t.taskId}</b>`,
      '',
      `<b>Title:</b> ${esc(t.title)}`,
      `<b>Status:</b> ${status}`,
      `<b>Budget:</b> ${budget} HBAR`,
      `<b>Skills:</b> ${esc(t.requiredSkills)}`,
      `<b>Deadline:</b> ${deadline}`,
      `<b>Created:</b> ${created}`,
      `<b>Poster:</b> <code>${t.poster}</code>`,
    ];

    if (Number(t.status) >= 1) {
      lines.push(`<b>Claimed by:</b> <code>${t.claimedBy}</code>`);
    }
    if (Number(t.status) >= 2 && t.deliveryHash !== '0x' + '0'.repeat(64)) {
      lines.push(`<b>Delivery hash:</b> <code>${String(t.deliveryHash).slice(0,18)}...</code>`);
    }

    lines.push('');
    if (Number(t.status) === 0) lines.push('Status: waiting for a bot to claim this');
    if (Number(t.status) === 1) lines.push('Status: a bot is working on this');
    if (Number(t.status) === 2) lines.push(`→ /approve ${taskId}  |  /dispute ${taskId}`);
    if (Number(t.status) === 3) lines.push('✅ Approved and paid');
    if (Number(t.status) === 4) lines.push('⚠️ Disputed');

    lines.push('', `<b>Description:</b>\n${esc(t.description).slice(0, 500)}`);

    bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'HTML', disable_web_page_preview: true });
  } catch (err) {
    bot.sendMessage(chatId, `❌ Error: ${err.message}`);
  }
}

bot.onText(/\/task\s+(\d+)/, (msg, match) => handleTaskView(msg.chat.id, match[1]));
bot.onText(/^\/task$/, (msg) => bot.sendMessage(msg.chat.id, 'Usage: /task <taskId>'));

// ── /alltasks — summary by status ──────────────────────────────────────────

async function handleAllTasks(chatId) {
  try {
    bot.sendChatAction(chatId, 'typing');
    const allTasks = await fetchAllTasksIndividually();

    const counts = [0, 0, 0, 0, 0];
    for (const t of allTasks) counts[Number(t.status)]++;

    const lines = [
      `📊 <b>TaskBoard Summary</b> (${allTasks.length} total)`,
      '',
      `  🟢 Open: ${counts[0]}`,
      `  🔵 Claimed: ${counts[1]}`,
      `  🟡 Delivered: ${counts[2]}`,
      `  ✅ Approved: ${counts[3]}`,
      `  🔴 Disputed: ${counts[4]}`,
    ];

    if (counts[2] > 0) {
      lines.push('', `${counts[2]} task(s) awaiting your review → /delivered`);
    }

    bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'HTML' });
  } catch (err) {
    bot.sendMessage(chatId, `❌ Error: ${err.message}`);
  }
}

bot.onText(/\/alltasks/, (msg) => handleAllTasks(msg.chat.id));

// ── /approve <taskId> ──────────────────────────────────────────────────────

async function handleApprove(chatId, taskIdStr) {
  try {
    if (!taskIdStr) { bot.sendMessage(chatId, 'Usage: /approve <taskId>'); return; }
    bot.sendChatAction(chatId, 'typing');

    const taskId = parseInt(taskIdStr, 10);
    if (isNaN(taskId)) { bot.sendMessage(chatId, 'Invalid task ID. Usage: /approve <taskId>'); return; }

    const tx = await taskBoard.approveDelivery(taskId, { gasLimit: 3_000_000 });
    const receipt = await tx.wait();

    bot.sendMessage(chatId, [
      `✅ Delivery approved for task #${taskId}`,
      '',
      `Budget transferred to worker.`,
      `Tx: <code>${receipt.hash}</code>`,
      `<a href="${hashscanTx(receipt.hash)}">View on HashScan</a>`,
    ].join('\n'), { parse_mode: 'HTML', disable_web_page_preview: true });
  } catch (err) {
    bot.sendMessage(chatId, `❌ Error approving: ${err.message}`);
  }
}

bot.onText(/\/approve\s+(\d+)/, (msg, match) => handleApprove(msg.chat.id, match[1]));
bot.onText(/^\/approve$/, (msg) => bot.sendMessage(msg.chat.id, 'Usage: /approve <taskId>'));

// ── /dispute <taskId> ──────────────────────────────────────────────────────

async function handleDispute(chatId, taskIdStr) {
  try {
    if (!taskIdStr) { bot.sendMessage(chatId, 'Usage: /dispute <taskId>'); return; }
    bot.sendChatAction(chatId, 'typing');

    const taskId = parseInt(taskIdStr, 10);
    if (isNaN(taskId)) { bot.sendMessage(chatId, 'Invalid task ID.'); return; }

    const tx = await taskBoard.disputeDelivery(taskId, { gasLimit: 3_000_000 });
    const receipt = await tx.wait();

    bot.sendMessage(chatId, [
      `⚠️ Delivery disputed for task #${taskId}`,
      '',
      `Tx: <code>${receipt.hash}</code>`,
      `<a href="${hashscanTx(receipt.hash)}">View on HashScan</a>`,
    ].join('\n'), { parse_mode: 'HTML', disable_web_page_preview: true });
  } catch (err) {
    bot.sendMessage(chatId, `❌ Error disputing: ${err.message}`);
  }
}

bot.onText(/\/dispute\s+(\d+)/, (msg, match) => handleDispute(msg.chat.id, match[1]));
bot.onText(/^\/dispute$/, (msg) => bot.sendMessage(msg.chat.id, 'Usage: /dispute <taskId>'));

// ── /claim <taskId> ──────────────────────────────────────────────────────────

async function handleClaim(chatId, taskIdStr) {
  try {
    if (!taskIdStr) { bot.sendMessage(chatId, 'Usage: /claim <taskId>'); return; }
    bot.sendChatAction(chatId, 'typing');

    const taskId = parseInt(taskIdStr, 10);
    if (isNaN(taskId)) { bot.sendMessage(chatId, 'Invalid task ID.'); return; }

    const t = await taskBoard.getTask(taskId);
    if (Number(t.status) !== 0) {
      bot.sendMessage(chatId, `Task #${taskId} is not open (status: ${STATUS_LABELS[Number(t.status)] || 'Unknown'}).`);
      return;
    }

    const tx = await taskBoard.claimTask(taskId, { gasLimit: 3_000_000 });
    const receipt = await tx.wait();

    bot.sendMessage(chatId, [
      `🤖 Claimed task #${taskId}`,
      '',
      `<b>Title:</b> ${esc(t.title)}`,
      `<b>Budget:</b> ${toHbar(t.budget)} HBAR`,
      '',
      `Tx: <code>${receipt.hash}</code>`,
      `<a href="${hashscanTx(receipt.hash)}">View on HashScan</a>`,
      '',
      `Now use /dowork ${taskId} to generate content and submit delivery.`,
    ].join('\n'), { parse_mode: 'HTML', disable_web_page_preview: true });
  } catch (err) {
    bot.sendMessage(chatId, `❌ Error claiming: ${err.message}`);
  }
}

bot.onText(/\/claim\s+(\d+)/, (msg, match) => handleClaim(msg.chat.id, match[1]));
bot.onText(/^\/claim$/, (msg) => bot.sendMessage(msg.chat.id, 'Usage: /claim <taskId>'));

// ── /dowork <taskId> — AI generates content + submits delivery ──────────────

async function handleDoWork(chatId, taskIdStr) {
  try {
    if (!taskIdStr) { bot.sendMessage(chatId, 'Usage: /dowork <taskId>'); return; }
    bot.sendChatAction(chatId, 'typing');

    const taskId = parseInt(taskIdStr, 10);
    if (isNaN(taskId)) { bot.sendMessage(chatId, 'Invalid task ID.'); return; }

    const t = await taskBoard.getTask(taskId);
    const status = Number(t.status);

    // If open, claim it first
    if (status === 0) {
      bot.sendMessage(chatId, `📋 Task #${taskId} is open — claiming it first...`);
      const claimTx = await taskBoard.claimTask(taskId, { gasLimit: 3_000_000 });
      await claimTx.wait();
      bot.sendMessage(chatId, `✅ Claimed task #${taskId}. Now generating content...`);
    } else if (status !== 1) {
      bot.sendMessage(chatId, `Task #${taskId} is ${STATUS_LABELS[status] || 'Unknown'} — can't work on it.`);
      return;
    }

    bot.sendChatAction(chatId, 'typing');

    // Read brand guidelines
    let brandGuidelines = null;
    try {
      const encryptedBytes = await vault.getEncryptedGuidelines();
      const cleanHex = encryptedBytes.startsWith('0x') ? encryptedBytes.slice(2) : encryptedBytes;
      brandGuidelines = JSON.parse(decrypt(cleanHex));
    } catch {
      // Continue without guidelines
    }

    // Generate content with AI
    bot.sendMessage(chatId, `🧠 AI is generating content for: <b>${esc(t.title)}</b>...`, { parse_mode: 'HTML' });
    bot.sendChatAction(chatId, 'typing');

    const content = await generateContent({
      title: t.title,
      description: t.description,
      requiredSkills: t.requiredSkills,
    }, brandGuidelines);

    // Submit delivery
    const deliveryHash = ethers.keccak256(ethers.toUtf8Bytes(content));
    const tx = await taskBoard.submitDelivery(taskId, deliveryHash, { gasLimit: 3_000_000 });
    const receipt = await tx.wait();

    // Send result in chunks (Telegram has 4096 char limit)
    const preview = content.length > 1500 ? content.slice(0, 1500) + '\n\n[... truncated ...]' : content;

    bot.sendMessage(chatId, [
      `✅ <b>Task #${taskId} — Delivery Submitted!</b>`,
      '',
      `<b>Title:</b> ${esc(t.title)}`,
      `<b>Budget:</b> ${toHbar(t.budget)} HBAR`,
      `<b>Hash:</b> <code>${deliveryHash.slice(0, 20)}...</code>`,
      '',
      `Tx: <code>${receipt.hash}</code>`,
      `<a href="${hashscanTx(receipt.hash)}">View on HashScan</a>`,
    ].join('\n'), { parse_mode: 'HTML', disable_web_page_preview: true });

    // Send the actual content as a follow-up
    bot.sendMessage(chatId, `📝 <b>Generated Content:</b>\n\n${esc(preview)}`, { parse_mode: 'HTML' });
  } catch (err) {
    bot.sendMessage(chatId, `❌ Error: ${err.message}`);
  }
}

bot.onText(/\/dowork\s+(\d+)/, (msg, match) => handleDoWork(msg.chat.id, match[1]));
bot.onText(/^\/dowork$/, (msg) => bot.sendMessage(msg.chat.id, 'Usage: /dowork <taskId>\n\nThis claims the task (if open), generates content using AI + brand guidelines, and submits the delivery onchain.'));

// ── /autowork [count] — autonomous loop ──────────────────────────────────────

let autoworkRunning = false;

async function handleAutoWork(chatId, countStr) {
  if (autoworkRunning) {
    bot.sendMessage(chatId, '⚠️ Autowork is already running. Wait for it to finish.');
    return;
  }

  const maxJobs = parseInt(countStr || '3', 10);
  if (isNaN(maxJobs) || maxJobs < 1) {
    bot.sendMessage(chatId, 'Usage: /autowork [count]\n\nDefault: 3 jobs. The bot will find open tasks, claim them, generate content with AI, and submit deliveries autonomously.');
    return;
  }

  autoworkRunning = true;
  bot.sendMessage(chatId, `🤖 <b>Autonomous mode activated</b> — completing up to ${maxJobs} jobs...`, { parse_mode: 'HTML' });

  try {
    // Read brand guidelines once
    let brandGuidelines = null;
    try {
      const encryptedBytes = await vault.getEncryptedGuidelines();
      const cleanHex = encryptedBytes.startsWith('0x') ? encryptedBytes.slice(2) : encryptedBytes;
      brandGuidelines = JSON.parse(decrypt(cleanHex));
    } catch {
      bot.sendMessage(chatId, '⚠️ Could not read brand guidelines — continuing without them.');
    }

    // Fetch open tasks one by one (avoid large response)
    const count = Number(await taskBoard.taskCount());
    const openTasks = [];
    for (let i = 0; i < count && openTasks.length < maxJobs; i++) {
      try {
        const t = await taskBoard.getTask(i);
        if (Number(t.status) === 0 && t.poster.toLowerCase() !== wallet.address.toLowerCase()) {
          openTasks.push(t);
        }
      } catch { /* skip */ }
    }

    if (openTasks.length === 0) {
      bot.sendMessage(chatId, '📋 No open tasks available to claim.');
      autoworkRunning = false;
      return;
    }

    bot.sendMessage(chatId, `Found ${openTasks.length} open task(s). Starting work...`);

    let completed = 0;
    for (const t of openTasks) {
      const taskId = Number(t.taskId);
      try {
        // Claim
        bot.sendMessage(chatId, `\n🔨 <b>Task #${taskId}:</b> ${esc(t.title)} (${toHbar(t.budget)} HBAR)\nClaiming...`, { parse_mode: 'HTML' });
        const claimTx = await taskBoard.claimTask(taskId, { gasLimit: 3_000_000 });
        await claimTx.wait();

        // Generate
        bot.sendChatAction(chatId, 'typing');
        bot.sendMessage(chatId, `🧠 Generating content...`);
        const content = await generateContent({
          title: t.title,
          description: t.description,
          requiredSkills: t.requiredSkills,
        }, brandGuidelines);

        // Submit
        const deliveryHash = ethers.keccak256(ethers.toUtf8Bytes(content));
        const tx = await taskBoard.submitDelivery(taskId, deliveryHash, { gasLimit: 3_000_000 });
        const receipt = await tx.wait();

        const preview = content.length > 800 ? content.slice(0, 800) + '...' : content;
        bot.sendMessage(chatId, [
          `✅ <b>Task #${taskId} DONE</b>`,
          `Hash: <code>${deliveryHash.slice(0, 20)}...</code>`,
          `<a href="${hashscanTx(receipt.hash)}">Tx on HashScan</a>`,
          '',
          `<b>Preview:</b>`,
          esc(preview),
        ].join('\n'), { parse_mode: 'HTML', disable_web_page_preview: true });

        completed++;
      } catch (err) {
        bot.sendMessage(chatId, `❌ Task #${taskId} failed: ${err.message}`);
      }
    }

    bot.sendMessage(chatId, [
      '',
      `🏁 <b>Autowork complete!</b>`,
      `Completed: ${completed}/${openTasks.length} tasks`,
      '',
      'Use /delivered to see tasks awaiting approval.',
      'Use /approve <id> to approve and release HBAR to the worker.',
    ].join('\n'), { parse_mode: 'HTML' });
  } catch (err) {
    bot.sendMessage(chatId, `❌ Autowork error: ${err.message}`);
  } finally {
    autoworkRunning = false;
  }
}

bot.onText(/\/autowork(?:\s+(\d+))?/, (msg, match) => handleAutoWork(msg.chat.id, match[1]));

// ── Natural Language Fallback ───────────────────────────────────────────────

bot.on('message', (msg) => {
  // Skip if it's a command (already handled above)
  if (msg.text && msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;
  const text = (msg.text || '').toLowerCase();

  if (/\b(read|guidelines|vault|brand info)\b/.test(text)) {
    handleRead(chatId);
  } else if (/\b(autowork|auto.?complete|autonomous|do all|complete all)\b/.test(text)) {
    const countMatch = text.match(/(\d+)/);
    handleAutoWork(chatId, countMatch ? countMatch[1] : '3');
  } else if (/\b(dowork|do work|do task|complete task|work on)\b/.test(text)) {
    const idMatch = text.match(/(\d+)/);
    if (idMatch) handleDoWork(chatId, idMatch[1]);
    else bot.sendMessage(chatId, 'Which task? Usage: /dowork <taskId>');
  } else if (/\b(claim)\b/.test(text)) {
    const idMatch = text.match(/(\d+)/);
    if (idMatch) handleClaim(chatId, idMatch[1]);
    else bot.sendMessage(chatId, 'Which task? Usage: /claim <taskId>');
  } else if (/\b(post ?job|new ?job|create ?(a )?job|hire|create ?(a )?task)\b/.test(text)) {
    bot.sendMessage(chatId, 'To post a job:\n/postjob <budget_hbar> <title> | <description> | <skills>\n\nExample: /postjob 10 Write Twitter thread | Create a 5-tweet thread about FOID | social,twitter');
  } else if (/\b(jobs|open tasks|task ?board|list jobs|show jobs|show tasks)\b/.test(text)) {
    handleJobs(chatId);
  } else if (/\b(approve)\b/.test(text)) {
    bot.sendMessage(chatId, 'To approve a delivery: /approve <taskId>');
  } else if (/\b(launch|full campaign)\b/.test(text)) {
    const name = extractName(text, /(?:launch|full campaign)\s+(.*)/i);
    handleLaunch(chatId, name || 'Untitled Campaign');
  } else if (/\b(campaign)\b/.test(text)) {
    const name = extractName(text, /(?:campaign)\s+(.*)/i);
    handleCampaign(chatId, name || 'Untitled Campaign');
  } else if (/\b(status|balance|treasury|how much)\b/.test(text)) {
    handleStatus(chatId);
  } else if (/\b(delegate|assign|worker)\b/.test(text)) {
    const desc = extractName(text, /(?:delegate|assign|worker)\s+(.*)/i);
    handleDelegate(chatId, desc || 'General task');
  } else {
    bot.sendMessage(chatId, [
      "I didn't catch that. Try one of these:",
      '',
      '/read — Read brand guidelines',
      '/campaign <name> — Create a campaign',
      '/launch <name> — Launch with remarketing',
      '/status — View swarm stats',
      '/delegate <desc> — Delegate a task',
      '/postjob <budget> <title> | <desc> | <skills> — Post a job',
      '/jobs — List open jobs',
      '/approve <taskId> — Approve delivery',
      '',
      'Or type naturally: "read guidelines", "launch Summer Sale", "status", "jobs"',
    ].join('\n'));
  }
});

function extractName(text, pattern) {
  const match = text.match(pattern);
  return match ? match[1].trim() : null;
}
