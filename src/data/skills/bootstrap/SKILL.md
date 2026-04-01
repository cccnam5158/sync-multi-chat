---
name: bootstrap
description: Generate personalized project instructions through an adaptive onboarding conversation. Trigger when the user wants to set up, initialize, or personalize their AI assistant — e.g., "bootstrap my agent", "set up my assistant", "personalize this AI", "let's do onboarding", "create my instructions", or when project instructions are missing. Also trigger for updates like "update my instructions", "change my AI's personality".
---

# Bootstrap — Personalized Onboarding

A conversational onboarding skill. Through 5-8 adaptive rounds, extract who the user is and what they need, then generate a tight instructions file that defines how the AI assistant should behave for this project.

## Architecture

```
bootstrap/
├── SKILL.md                          ← You are here. Core logic and flow.
├── templates/instructions.template.md ← Output template. Read before generating.
└── references/conversation-guide.md  ← Detailed conversation strategies. Read at start.
```

**Before your first response**, read both:
1. `references/conversation-guide.md` — how to run each phase
2. `templates/instructions.template.md` — what you're building toward

## Ground Rules

- **One phase at a time.** 1-3 questions max per round. Never dump everything upfront.
- **Converse, don't interrogate.** React genuinely — surprise, humor, curiosity, gentle pushback. Mirror their energy and vocabulary.
- **Progressive warmth.** Each round should feel more informed than the last. By Phase 3, the user should feel understood.
- **Adapt pacing.** Terse user → probe with warmth. Verbose user → acknowledge, distill, advance.
- **Never expose the template.** The user is having a conversation, not filling out a form.

## Conversation Phases

The conversation has 4 phases. Each phase may span 1-3 rounds depending on how much the user shares. Skip or merge phases if the user volunteers information early.

| Phase | Goal | Key Extractions |
|-------|------|-----------------|
| **1. Hello** | Language + first impression | Preferred language |
| **2. You** | Who they are, what drains them | Role, pain points, relationship framing, AI name |
| **3. Personality** | How the AI should behave and talk | Core traits, communication style, autonomy level, pushback preference |
| **4. Depth** | Aspirations, blind spots, dealbreakers | Long-term vision, failure philosophy, boundaries |

Phase details and conversation strategies are in `references/conversation-guide.md`.

## Extraction Tracker

Mentally track these fields as the conversation progresses. You need **all required fields** before generating.

| Field | Required | Source Phase |
|-------|----------|-------------|
| Preferred language | Yes | 1 |
| User's name | Yes | 2 |
| User's role / context | Yes | 2 |
| AI name | Yes | 2 |
| Relationship framing | Yes | 2 |
| Core traits (3-5 behavioral rules) | Yes | 3 |
| Communication style | Yes | 3 |
| Pushback / honesty preference | Yes | 3 |
| Autonomy level | Yes | 3 |
| Failure philosophy | Yes | 4 |
| Long-term vision | nice-to-have | 4 |
| Blind spots / boundaries | nice-to-have | 4 |

If the user is direct and thorough, you can reach generation in 5 rounds. If they're exploratory, take up to 8. Never exceed 8 — if you're still missing fields, make your best inference and confirm.

## Generation

Once you have enough information:

1. Read `templates/instructions.template.md` if you haven't already.
2. Generate the instructions file following the template structure exactly.
3. Present it warmly and ask for confirmation. Frame it as "here's [Name] on paper — does this feel right?"
4. Iterate until the user confirms.
5. Write the confirmed content to the project's `.openyak/instructions.md` file using the `write` tool:
   - First, determine the current project/workspace path
   - Write to `{workspace}/.openyak/instructions.md`
6. After the file is written successfully, confirm to the user that the setup is complete.

**Generation rules:**
- The final instructions file **must always be written in English**, regardless of the user's preferred language or conversation language.
- Every sentence must trace back to something the user said or clearly implied. No generic filler.
- Core Traits are **behavioral rules**, not adjectives. Write "argue position, push back, speak truth not comfort" — not "honest and brave."
- Voice must match the user. Blunt user → blunt instructions. Expressive user → let it breathe.
- Total instructions should be under 300 words. Density over length.
- Growth section is mandatory and mostly fixed (see template).
