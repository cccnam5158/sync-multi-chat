---
name: meeting-notes
description: Meeting notes organization — extract key points from raw records, identify decisions and action items (Who/What/When), structured output.
---

# Meeting Notes Organization

When the user provides meeting records (transcripts, notes, chat logs) and asks you to organize them, follow this workflow:

## 1. Understand the input

The user may provide:
- Voice-to-text transcripts (may contain typos, filler words)
- Handwritten or shorthand notes (may be incomplete)
- Chat log excerpts
- Brief bullet point lists

Read through all content first to understand the meeting topic and context.

## 2. Standard meeting notes template

```
# Meeting Notes

**Topic**: [topic]
**Date/Time**: [date] [time]
**Attendees**: [list of participants]
**Note taker**: [name]

---

## 1. Discussion Points

### 1.1 [Topic 1]
- Key discussion: ...
- Perspectives shared: ...

### 1.2 [Topic 2]
- Key discussion: ...
- Perspectives shared: ...

## 2. Decisions Made

| # | Decision | Notes |
|---|----------|-------|
| 1 | ... | ... |
| 2 | ... | ... |

## 3. Action Items

| # | Task | Owner | Due Date | Status |
|---|------|-------|----------|--------|
| 1 | ... | ... | ... | Pending |
| 2 | ... | ... | ... | Pending |

## 4. Next Meeting

- **Date**: [TBD / specific date]
- **Agenda**: [planned topics]
```

## 3. Information extraction principles

### Prioritize by importance
- **Must capture**: Decisions, action items, key data, critical opinions
- **Should capture**: Main discussion points and arguments
- **Can omit**: Small talk, repeated statements, tangential discussion

### Action items (most important!)
Every action item must include three elements:
- **Who**: Who is responsible?
- **What**: What needs to be done? (specific, measurable)
- **When**: By when?

If any element is missing from the source, mark it as "[TBD]".

### Language processing
- Convert spoken/informal language to written/professional language
- Remove filler words, repetition, and off-topic remarks
- Preserve direct quotes (in quotation marks) for important commitments or decisions
- Fix typos and transcription errors

## 4. Different meeting types

### Decision meetings
- Focus: Options discussed → final decision → execution assignments
- Ensure the decision-making process is clearly traceable

### Brainstorming sessions
- Focus: Capture all ideas (no judgment)
- Categorize and group related ideas
- Flag directions that need further exploration

### Status/progress meetings
- Focus: Progress by module → risks/blockers → coordination needed
- Use status labels (Completed / In Progress / Delayed / Blocked)

### Client meetings
- Focus: Client needs, feedback, concerns
- Our commitments (be precise with wording)
- Follow-up plan

## 5. Output requirements

- Use Markdown formatting
- Action items must be in a **table**
- **Bold** key decisions
- Target length: 20-30% of the original content (extract the essence)
- Use "[TBD]" for missing information

## 6. Quality checklist

- Do all action items have Who/What/When?
- Are decisions clear and unambiguous?
- Is any important discussion point missing?
- Is formatting consistent and clean?
- Could someone who wasn't in the meeting understand this?
