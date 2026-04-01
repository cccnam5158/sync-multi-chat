# Block Diagram Templates

## Basic Architecture

```mermaid
block-beta
    columns 3
    a["Web Browser"]:2 b["Mobile App"]
    space c["API Gateway"] space

    block:e:3
        columns 3
        f["Auth Service"] g["User Service"] h["Payment Service"]
    end

    j[("Database")]:2 k[("Cache")]

    a --> c
    b --> c
    c --> e
    e --> j
    e --> k
```

## System Overview

```mermaid
block-beta
    columns 2
    a["Frontend"]
    b["Backend"]
    c[("PostgreSQL")]
    d[("Redis")]

    a --> b
    b --> c
    b --> d
```

## Key Syntax

- `block-beta` - Declaration keyword
- `columns N` - Set number of columns
- **Shapes**: `a["label"]` square, `a("label")` round, `a[("label")]` cylinder, `a(("label"))` circle, `a{"label"}` diamond, `a{{"label"}}` hexagon
- **Spanning**: `a["label"]:N` - span N columns
- **Spacing**: `space` or `space:N` for multi-column space
- **Nested blocks**: `block:id:width ... end`
- **Links**: `a --> b`, `a --- b`, `a -->|"label"| b`
- **Styling**: `style id fill:#f9f,stroke:#333`
