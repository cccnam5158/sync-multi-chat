# Pie Chart Templates

## Basic Distribution

```mermaid
pie title Market Share
    "Company A" : 45
    "Company B" : 25
    "Company C" : 20
    "Others" : 10
```

## Budget Breakdown

```mermaid
pie title Budget Allocation
    "Engineering" : 40
    "Marketing" : 25
    "Operations" : 15
    "Sales" : 12
    "Admin" : 8
```

## Survey Results

```mermaid
pie title Customer Satisfaction
    "Very Satisfied" : 35
    "Satisfied" : 40
    "Neutral" : 15
    "Dissatisfied" : 7
    "Very Dissatisfied" : 3
```

## Key Syntax

- `pie title Title` - Chart with title
- `pie showData` - Show values on slices
- `"Label" : value` - Each slice with label and numeric value
- Values are proportional (don't need to sum to 100)
- **IMPORTANT**: For non-ASCII (Chinese, etc.) title text, use `pie title "中文标题"` with quotes
