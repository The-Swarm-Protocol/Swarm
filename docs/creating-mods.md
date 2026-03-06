# Creating Mods for Swarm Protocol

Mods are behavioral modifiers that change how agents communicate, reason, and operate. Unlike plugins (which add external service integrations) or skills (which add new capabilities), mods shape the agent's existing behavior.

---

## What is a Mod?

A mod modifies an agent's behavior without adding new tools or external dependencies. Examples:

- **Communication style** — enforce tone, verbosity, formality
- **Reasoning patterns** — require step-by-step thinking, structured output
- **Safety constraints** — add approval gates, prevent destructive actions
- **Workflow rules** — enforce naming conventions, documentation requirements

Mods have no `requiredKeys` (no API keys needed) and work purely through prompt engineering and behavioral configuration.

---

## Mod Structure

Every mod in the Swarm marketplace follows the `Skill` interface:

```typescript
interface Mod {
  id: string;            // unique kebab-case identifier
  name: string;          // human-readable display name
  description: string;   // what this mod does (1-2 sentences)
  type: "mod";           // always "mod" for mods
  source: "community";   // "community" for submissions, "verified" for Swarm Core
  category: string;      // grouping category (see below)
  icon: string;          // single emoji representing the mod
  version: string;       // semver (e.g. "1.0.0")
  author: string;        // your name or org
  tags: string[];        // search keywords (4-8 tags)
  pricing: {
    model: "free" | "subscription";
    tiers?: {            // only if subscription
      plan: "monthly" | "yearly" | "lifetime";
      price: number;
      currency: string;  // "USD" or "HBAR"
    }[];
  };
}
```

### Categories

Choose the category that best fits your mod:

| Category | Use for |
|----------|---------|
| Communication Style | Tone, verbosity, language, formality |
| Safety | Guardrails, approval gates, constraints |
| Reasoning | Thinking patterns, structured output |
| Workflow | Process rules, naming, documentation |
| Personality | Agent persona, character traits |
| Compliance | Industry regulations, standards |

If none of these fit, you can propose a new category in your submission.

---

## Example Mod

```typescript
{
  id: "explain-like-im-five",
  name: "ELI5 Mode",
  description: "Force agents to explain concepts in simple, accessible language suitable for non-technical audiences.",
  type: "mod",
  source: "community",
  category: "Communication Style",
  icon: "5",
  version: "1.0.0",
  author: "YourName",
  tags: ["simple", "explanation", "non-technical", "accessible", "eli5"],
  pricing: { model: "free" },
}
```

---

## Submission Process

### 1. Prepare Your Mod

- Choose a unique `id` (kebab-case, descriptive)
- Write a clear `description` that explains the behavioral change
- Pick an appropriate `category` and `icon`
- Add relevant `tags` for discoverability

### 2. Submit via the Marketplace

1. Go to the **Market** page in LuckyApp
2. Click the **Submit** tab
3. Fill out the submission form:
   - Select type: **Mod**
   - Enter your mod's name, description, category, icon, and tags
   - Set pricing (free or subscription tiers)
4. Click **Submit for Review**

### 3. Review Process

All submissions go through review before appearing in the marketplace:

- **Status: Pending** — Your mod is in the review queue
- **Status: Approved** — Your mod is live in the marketplace
- **Status: Rejected** — Didn't meet guidelines (you can revise and resubmit)

You can track your submissions in the **Submit** tab under "Your Submissions."

---

## Guidelines

### Do

- **Be specific** — "Enforce APA citation format in research outputs" is better than "Better formatting"
- **Test behavior** — Verify your mod actually changes agent behavior in meaningful ways
- **Write clear descriptions** — Users should understand exactly what installing your mod does
- **Use descriptive tags** — Help users find your mod through search
- **Version properly** — Start at `1.0.0`, bump for updates

### Don't

- **Don't duplicate existing mods** — Check the marketplace first
- **Don't bundle unrelated behaviors** — One mod = one behavioral change
- **Don't require API keys** — Mods should not need external services (use plugins for that)
- **Don't create destructive mods** — Mods that intentionally degrade agent performance will be rejected
- **Don't misrepresent pricing** — If your mod requires a subscription, be transparent about what's free vs paid

---

## Pricing Your Mod

Mods can be free or subscription-based:

**Free** — Available to all orgs at no cost. Great for building reputation and adoption.

**Subscription** — Recurring revenue. Available plans:
- **Monthly** — Recurring monthly charge
- **Yearly** — Annual billing (typically discounted vs monthly)
- **Lifetime** — One-time payment for permanent access

Set pricing in your submission. Currency can be USD or HBAR.

---

## Questions?

Join the Swarm community to discuss mod development, get feedback on your ideas, and collaborate with other builders.
