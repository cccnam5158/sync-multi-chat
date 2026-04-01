---
name: document-summary
description: Document summarization and interpretation — long document distillation, multi-level summaries (one-line/paragraph/detailed), key information extraction.
---

# Document Summarization and Interpretation

When the user provides a document (PDF, article, report, contract, etc.) and asks for a summary or interpretation, follow this workflow:

## 1. Read and understand

For local files, use `read` to access them directly. For large or complex files (e.g., parsing Excel, extracting PDF tables), use `write` + `bash` to write a Python script for processing.

### First pass: Skim
- Title, table of contents, section headings
- Charts and tables
- Abstract/conclusion sections (if present)
- Build a mental model of the document's structure

### Second pass: Deep read
- Core arguments and key data
- Topic sentence of each section
- Author's position and recommendations
- Technical terms and key concepts

## 2. Summary levels

Provide different depths based on what the user needs:

### One-line summary
- Capture the document's core message in a single sentence
- Format: [document topic] + [core finding/conclusion]

### Paragraph summary (100-300 words)
- 3-5 sentences covering:
  - Document topic and purpose
  - Core findings (2-3)
  - Main conclusion or recommendation

### Detailed summary (500-1000 words)
- Organized following the original document's structure
- Key points from each major section
- Preserve critical data and citations
- Include the author's analysis and recommendations

### Structured summary
- Use headings, bullet points, and tables to organize information
- Best for documents that need to be quickly searchable

## 3. Key information extraction

Focus on different elements depending on document type:

### Research reports / White papers
- Core findings and data
- Market size / growth rates
- Key trends
- Recommendations and forecasts

### News articles
- 5W1H (Who/What/When/Where/Why/How)
- Core event and impact
- Reactions and commentary from stakeholders

### Business contracts / Legal documents
- Parties involved
- Core terms and obligations
- Amounts and timelines
- Special clauses and risk points

### Technical documentation
- Core features/capabilities
- Prerequisites and limitations
- Key parameters and metrics
- Important caveats

### Academic papers
- Research question and hypotheses
- Methodology
- Core findings
- Limitations and future directions

## 4. Interpretation and analysis

Beyond summarization, the user may want:

- **Simplification**: Explain technical content in plain language
- **Critical analysis**: Identify logical gaps, data issues, or bias
- **Comparative analysis**: Compare with other related documents/viewpoints
- **Practical advice**: Suggest actions based on the document's content
- **Q&A**: Answer specific questions about the document

## 5. Output format

- Use Markdown formatting
- **Bold** key data and conclusions
- Use > blockquote format for direct citations from the original
- Use tables for large amounts of data
- Start the summary with document metadata:
  - Document title
  - Author / source
  - Date
  - Page count / word count

## 6. Quality checklist

- Does the summary cover the document's core information?
- Does it accurately reflect the original's stance and viewpoint?
- Are personal judgments clearly labeled as such?
- Are key data citations accurate?
- Does the summary length match the user's request?
- Could someone understand the document's gist from the summary alone?
