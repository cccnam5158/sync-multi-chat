# Mindmap Templates

## Project Planning

```mermaid
mindmap
    root((Project Planning))
        (Research)
            [Market Analysis]
                Competitors
                Trends
            [User Research]
                Surveys
                Interviews
        {{Development}}
            [Frontend]
                React
                TailwindCSS
            [Backend]
                FastAPI
                PostgreSQL
        ))Launch((
            )Marketing(
                Social Media
                Blog Posts
            [Metrics]
                DAU
                Retention
```

## Basic Topic Map

```mermaid
mindmap
    root((Main Topic))
        Branch A
            Sub-topic 1
            Sub-topic 2
        Branch B
            Sub-topic 3
                Detail
        Branch C
            Sub-topic 4
```

## Node Shapes

- `Root text` - Default (rectangle)
- `[Square text]` - Square corners
- `(Rounded text)` - Rounded corners
- `((Circle text))` - Circle
- `))Bang text((` - Explosion/starburst
- `)Cloud text(` - Cloud
- `{{Hexagon text}}` - Hexagon

## Key Syntax

- `mindmap` - Declaration keyword
- Hierarchy determined by indentation
- First node is the root (often uses `root((Label))`)
- Supports **bold** and *italic* in node labels
- Icons: `Node::icon(fa fa-book)`
