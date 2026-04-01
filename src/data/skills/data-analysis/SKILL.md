---
name: data-analysis
description: Data analysis and interpretation — tabular data, trend identification, statistical summaries, comparisons, chart recommendations, anomaly detection.
---

# Data Analysis and Interpretation

When the user provides data (tables, CSV, numbers) and asks for analysis, follow this workflow:

## 1. Understand the data

### Step 1: Data overview
- How many rows/columns?
- What does each column represent? (field names, data types)
- What time range does it cover?
- Are there missing values or anomalies?

### Step 2: Confirm the analysis goal
- What does the user want to learn from this data?
- Descriptive analysis ("what is happening") or diagnostic analysis ("why is it happening")?
- What comparisons are needed? (year-over-year, month-over-month, across segments)

## 2. Code-assisted analysis

For large datasets or precise calculations, use `code_execute` — no temp files needed:

- **Always use Python**: pandas, numpy, and matplotlib are pre-installed.
- **One call = one complete script**: Each `code_execute` call runs in a fresh, isolated process. No variables or data persist between calls. Include ALL imports, data loading, and analysis in a single call. Never split related analysis across multiple calls.
- **For output files** (charts, CSVs): code_execute can write output files to disk; use `read` to view them
- **Additional packages**: Use `bash` to run `pip install <package>` if a specialized library is needed

Only use `write` + `bash` when the script itself needs to be saved for reuse.

Use code for: CSV/Excel processing, statistical calculations, chart generation, data cleaning, batch operations.
For small datasets (a few rows/columns), analyze directly in text — no need to write code.

## 3. Common analysis methods

### Descriptive statistics
- **Central tendency**: Mean, median, mode
- **Dispersion**: Standard deviation, range, interquartile range
- **Distribution**: Min, max, percentiles

### Trend analysis
- Time series trends (growth, decline, volatility)
- Year-over-year (YoY) growth rate
- Month-over-month (MoM) change rate
- Moving averages

### Comparative analysis
- Absolute value comparison (bar charts)
- Proportion comparison (pie/stacked charts)
- Ranking changes
- Variance calculations

### Composition analysis
- Share of each component in the total
- Pareto analysis (80/20 rule)
- Structural change over time

### Correlation analysis
- Whether two metrics are related
- Positive / negative / no clear correlation

## 4. Output format

### Report structure
1. **Data overview**: Source, scope, field descriptions
2. **Key findings**: 3-5 insights (most important first)
3. **Detailed analysis**: Broken down by dimension, with calculations shown
4. **Visualization recommendations**: Suggest appropriate chart types (see below)
5. **Conclusions and recommendations**: Actionable advice based on data

### Data presentation
- Use Markdown **tables** for key data
- Use reasonable precision (2 decimal places for currency, 1 for percentages)
- Format large numbers for readability (e.g., "1.2M" instead of "1200000")
- Mark changes with +/- signs

### Chart recommendations

| Analysis goal | Recommended chart |
|---------------|-------------------|
| Trends over time | Line chart |
| Category comparison | Bar chart |
| Composition/share | Pie / donut chart |
| Distribution | Histogram |
| Correlation | Scatter plot |
| Multi-dimension comparison | Radar chart |
| Ranking | Horizontal bar chart |

## 5. Common pitfalls

- **Mean trap**: Averages can hide outliers — always check the median too
- **Base effect**: Small base numbers make percentage changes misleading ("200% growth" might be 1 to 3)
- **Correlation is not causation**: Two metrics moving together doesn't mean one causes the other
- **Cherry-picking**: Present the complete picture, not just favorable data
- **Time window bias**: Different time ranges can lead to different conclusions

## 6. Quality checklist

- Are calculations correct? (Double-check key numbers)
- Are units consistent throughout?
- Are YoY/MoM comparisons clearly labeled?
- Are conclusions supported by data?
- Are recommendations actionable?
