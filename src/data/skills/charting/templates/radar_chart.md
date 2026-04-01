# Radar Chart Templates (Beta)

## Skills Assessment

```mermaid
radar-beta
    title Technical Skills Assessment
    axis html["HTML"], css["CSS"], js["JavaScript"], py["Python"], sql["SQL"]
    curve alice["Alice"]{4, 3, 5, 2, 4}
    curve bob["Bob"]{3, 5, 2, 4, 3}
```

## Team Comparison

```mermaid
---
config:
  radar:
    max: 10
    graticule: polygon
    ticks: 5
---
radar-beta
    title Team Performance
    axis speed["Speed"], quality["Quality"], comm["Communication"], lead["Leadership"], innovation["Innovation"]
    curve teamA["Team Alpha"]{8, 6, 9, 7, 5}
    curve teamB["Team Beta"]{6, 9, 7, 8, 8}
```

## Key Syntax

- `radar-beta` - Declaration keyword (beta suffix required)
- `title Title Text` - Chart title
- `axis id1["Label1"], id2["Label2"], ...` - Define axes
- `curve id["Label"]{v1, v2, v3, ...}` - Data curve with sequential values
- `curve id["Label"]{ axisId: value, ... }` - Data curve with named axis values
- Config: `max`, `min`, `ticks`, `graticule` ("circle"/"polygon"), `showLegend`
