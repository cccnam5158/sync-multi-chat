# Quadrant Chart Templates

## Basic Quadrant Chart

```mermaid
quadrantChart
    title Reach and Engagement of Campaigns
    x-axis Low Reach --> High Reach
    y-axis Low Engagement --> High Engagement
    quadrant-1 We should expand
    quadrant-2 Need to promote
    quadrant-3 Re-evaluate
    quadrant-4 May be improved
    Campaign A: [0.3, 0.6]
    Campaign B: [0.45, 0.23]
    Campaign C: [0.57, 0.69]
    Campaign D: [0.78, 0.34]
    Campaign E: [0.40, 0.34]
    Campaign F: [0.35, 0.78]
```

## Priority Matrix (Eisenhower)

```mermaid
quadrantChart
    title Priority Matrix
    x-axis Not Urgent --> Urgent
    y-axis Not Important --> Important
    quadrant-1 Do First
    quadrant-2 Schedule
    quadrant-3 Eliminate
    quadrant-4 Delegate
    Bug fix: [0.9, 0.8]
    New feature: [0.3, 0.7]
    Code cleanup: [0.2, 0.3]
    Meeting prep: [0.7, 0.2]
    Documentation: [0.4, 0.5]
```

## Key Syntax

- `quadrantChart` - Declaration keyword
- `x-axis Left Label --> Right Label` - Horizontal axis
- `y-axis Bottom Label --> Top Label` - Vertical axis
- `quadrant-1` through `quadrant-4` - Quadrant labels (1=top-right, 2=top-left, 3=bottom-left, 4=bottom-right)
- `Point Name: [x, y]` - Data point (x and y range from 0.0 to 1.0)
- Optional point styling: `Point: [x, y] color: #ff0000, radius: 15`
- **IMPORTANT**: For non-ASCII (Chinese, etc.) text in title, axis labels, quadrant labels, and point names, wrap them in double quotes
