# XY Chart Templates

## Bar and Line Chart

```mermaid
xychart-beta
    title "Monthly Sales Performance"
    x-axis ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
    y-axis "Revenue (USD)" 0 --> 150
    bar [52, 96, 120, 78, 110, 140]
    line [52, 96, 120, 78, 110, 140]
```

## Bar Chart Only

```mermaid
xychart-beta
    title "Team Velocity"
    x-axis ["Sprint 1", "Sprint 2", "Sprint 3", "Sprint 4", "Sprint 5"]
    y-axis "Story Points" 0 --> 50
    bar [21, 34, 28, 42, 38]
```

## Horizontal Chart

```mermaid
xychart-beta horizontal
    title "Feature Adoption"
    x-axis ["Search", "Export", "Import", "Share", "Collab"]
    y-axis "Users %" 0 --> 100
    bar [85, 62, 45, 73, 38]
```

## Key Syntax

- `xychart-beta` - Declaration keyword (add `horizontal` for horizontal orientation)
- `title "Chart Title"` - Title (**ALWAYS use double quotes**)
- `x-axis ["cat1", "cat2", ...]` - Categorical x-axis (**ALWAYS quote each label**)
- `x-axis "Label" min --> max` - Numeric x-axis range
- `y-axis "Label" min --> max` - Numeric y-axis range
- `bar [v1, v2, ...]` - Bar series
- `line [v1, v2, ...]` - Line series
- Multiple bar/line series can be overlaid
- **IMPORTANT**: Non-ASCII characters (Chinese, etc.) in title and labels MUST be in double quotes or you will get a syntax error
