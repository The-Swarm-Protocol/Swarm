#!/usr/bin/env node
require('dotenv').config();
const crypto = require('crypto');
const { ethers } = require('ethers');
const TelegramBot = require('node-telegram-bot-api');

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
  'function getOpenTasks() view returns (tuple(uint256 taskId, address vault, string title, string description, string requiredSkills, uint256 deadline, uint256 budget, address poster, address claimedBy, bytes32 deliveryHash, uint256 createdAt, uint8 status)[])',
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
    'Commands:',
    '/read — Read & decrypt brand guidelines from the vault',
    '/campaign <name> — Create a campaign onchain',
    '/launch <name> — Launch campaign + schedule remarketing (7 days)',
    '/status — View vault, treasury & registry stats',
    '/delegate <description> — Delegate a task to a worker agent',
    '/postjob <budget> <title> | <description> | <skills> — Post a job to the TaskBoard',
    '/jobs — List open jobs on the TaskBoard',
    '',
    'You can also type naturally — e.g. "read guidelines" or "launch Summer Sale".',
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

async function handleJobs(chatId) {
  try {
    bot.sendChatAction(chatId, 'typing');
    const freshProvider = new ethers.JsonRpcProvider(HEDERA_RPC_URL, { chainId: 296, name: 'hedera-testnet' });
    const readBoard = new ethers.Contract(SWARM_TASK_BOARD_ADDRESS, taskBoardABI, freshProvider);
    const tasks = await readBoard.getOpenTasks();

    if (tasks.length === 0) {
      bot.sendMessage(chatId, '📋 No open jobs on the TaskBoard.\n\nPost one with /postjob');
      return;
    }

    const lines = [`📋 <b>Open Jobs</b> (${tasks.length})`, ''];
    for (const t of tasks) {
      const budget = ethers.formatEther(t.budget);
      lines.push(`<b>#${t.taskId}</b> — ${esc(t.title)}`);
      lines.push(`  💰 ${budget} HBAR | 🏷 ${esc(t.requiredSkills)}`);
      lines.push('');
    }
    lines.push(`<a href="https://frontend-blue-one-76.vercel.app/jobs">View on Dashboard</a>`);

    bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'HTML', disable_web_page_preview: true });
  } catch (err) {
    bot.sendMessage(chatId, `❌ Error fetching jobs: ${err.message}`);
  }
}

bot.onText(/\/jobs/, (msg) => handleJobs(msg.chat.id));

// ── Natural Language Fallback ───────────────────────────────────────────────

bot.on('message', (msg) => {
  // Skip if it's a command (already handled above)
  if (msg.text && msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;
  const text = (msg.text || '').toLowerCase();

  if (/\b(read|guidelines|vault|brand info)\b/.test(text)) {
    handleRead(chatId);
  } else if (/\b(launch|full campaign)\b/.test(text)) {
    const name = extractName(text, /(?:launch|full campaign)\s+(.*)/i);
    handleLaunch(chatId, name || 'Untitled Campaign');
  } else if (/\b(campaign|create)\b/.test(text)) {
    const name = extractName(text, /(?:campaign|create)\s+(.*)/i);
    handleCampaign(chatId, name || 'Untitled Campaign');
  } else if (/\b(status|balance|treasury|how much)\b/.test(text)) {
    handleStatus(chatId);
  } else if (/\b(delegate|assign|worker)\b/.test(text)) {
    const desc = extractName(text, /(?:delegate|assign|worker)\s+(.*)/i);
    handleDelegate(chatId, desc || 'General task');
  } else if (/\b(jobs|open tasks|task ?board)\b/.test(text)) {
    handleJobs(chatId);
  } else if (/\b(post ?job|new ?job|create ?job|hire)\b/.test(text)) {
    bot.sendMessage(chatId, 'To post a job:\n/postjob <budget_hbar> <title> | <description> | <skills>\n\nExample: /postjob 10 Write Twitter thread | Create a 5-tweet thread about FOID | social,twitter');
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
      '',
      'Or type naturally: "read guidelines", "launch Summer Sale", "status", "jobs"',
    ].join('\n'));
  }
});

function extractName(text, pattern) {
  const match = text.match(pattern);
  return match ? match[1].trim() : null;
}
