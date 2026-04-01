# Mermaid Syntax Reference

## CRITICAL: Quoting Rules for Non-ASCII Characters

**Many Mermaid diagram parsers only recognize ASCII letters (`[A-Za-z]`) as unquoted text.** Chinese, Japanese, Korean, and other non-ASCII characters MUST be wrapped in double quotes (`"..."`), or the parser will throw a syntax error.

This applies to: **titles, axis labels, category names, node labels** in these diagram types:
- `xychart-beta`: title, x-axis labels, y-axis label — ALL must be quoted if non-ASCII
- `quadrantChart`: title, axis labels, point names — quote if non-ASCII
- `pie`: title can be unquoted for ASCII, but quote for non-ASCII
- Other diagram types: when in doubt, always quote non-ASCII text with `"..."`

**Example (WRONG — will cause syntax error):**
```
xychart-beta
    title 2026年价格走势
    x-axis [1月, 2月, 3月]
```

**Example (CORRECT):**
```
xychart-beta
    title "2026年价格走势"
    x-axis ["1月", "2月", "3月"]
```

---

## All Diagram Types

| Diagram | Keyword | Status |
|---------|---------|--------|
| Flowchart | `graph` or `flowchart` | Stable |
| Sequence Diagram | `sequenceDiagram` | Stable |
| Class Diagram | `classDiagram` | Stable |
| State Diagram | `stateDiagram-v2` | Stable |
| ER Diagram | `erDiagram` | Stable |
| User Journey | `journey` | Stable |
| Gantt Chart | `gantt` | Stable |
| Pie Chart | `pie` | Stable |
| Quadrant Chart | `quadrantChart` | Stable |
| Requirement Diagram | `requirementDiagram` | Stable |
| GitGraph | `gitgraph` | Stable |
| C4 Diagram | `C4Context` / `C4Container` / `C4Component` / `C4Dynamic` / `C4Deployment` | Stable |
| Mindmap | `mindmap` | Stable |
| Timeline | `timeline` | Stable |
| ZenUML | `zenuml` | Stable |
| Sankey | `sankey-beta` | Beta |
| XY Chart | `xychart-beta` | Beta |
| Block Diagram | `block-beta` | Beta |
| Packet | `packet-beta` | Beta |
| Kanban | `kanban` | Stable |
| Architecture | `architecture-beta` | Beta |
| Radar Chart | `radar-beta` | Beta |
| Treemap | `treemap-beta` | Beta |

---

## Flowchart / Graph

### Direction
- `graph TD` or `graph TB` - Top to bottom
- `graph LR` - Left to right
- `graph BT` - Bottom to top
- `graph RL` - Right to left

### Node Shapes
```
id[Rectangle]       id(Rounded)         id{Diamond}
id([Stadium])       id[(Cylinder)]      id((Circle))
id[/Parallelogram/] id[\Parallelogram\] id[/Trapezoid\]
id>Flag]            id{{Hexagon}}
```

### Arrow Types
```
A --> B       Solid arrow          A --- B       Solid line
A -.-> B      Dotted arrow         A -.- B       Dotted line
A ==> B       Thick arrow          A === B       Thick line
A --text--> B Arrow with label     A -->|text| B Arrow with label (alt)
```

### Subgraphs
```
subgraph Title
    A --> B
end
```

---

## Sequence Diagram

### Messages
```
A->>B: Sync call        A-->>B: Response
A-)B: Async call         A--)B: Async response
A-xB: Failed call        A--xB: Failed response
```

### Control Flow
```
alt/else/end    opt/end    loop/end    par/and/end
critical/option/end    break/end
```

### Other
```
activate A / deactivate A    Note over A,B: text
```

---

## Class Diagram

### Visibility
```
+public  -private  #protected  ~internal
```

### Relationships
```
A <|-- B  Inheritance       A <|.. B  Implementation
A *-- B   Composition       A o-- B   Aggregation
A --> B   Association       A ..> B   Dependency
```

---

## State Diagram

```
stateDiagram-v2
    [*] --> State1              Start/End markers
    State1 --> State2: Event    Transition
    state Composite {           Nested states
        [*] --> SubState
    }
    state fork <<fork>>         Fork/Join
    --                          Concurrent separator
```

---

## ER Diagram

### Relationships
```
||--||  Exactly one to one      ||--o{  One to zero-many
||--|{  One to one-many         }o--o{  Zero-many to zero-many
```

### Attributes
```
ENTITY { type name PK    type name FK    type name UK }
```

---

## User Journey

```
journey
    title Title
    section Phase Name
        Task name: score: actor1, actor2
```
Score: 1 (worst) to 5 (best). Multiple actors comma-separated.

---

## Gantt Chart

```
gantt
    title Title
    dateFormat YYYY-MM-DD
    section Section
    Task :id, start, duration
    Task :after id, duration
```
Modifiers: `:active`, `:done`, `:crit`, `:milestone`

---

## Pie Chart

```
pie showData
    title Title
    "Label" : value
```

---

## Quadrant Chart

```
quadrantChart
    title Title
    x-axis Left --> Right
    y-axis Bottom --> Top
    quadrant-1 Top-Right Label
    quadrant-2 Top-Left Label
    quadrant-3 Bottom-Left Label
    quadrant-4 Bottom-Right Label
    Point Name: [x, y]
```
x and y range from 0.0 to 1.0.

---

## Requirement Diagram

```
requirementDiagram
    requirement name {
        id: 1
        text: description
        risk: low|medium|high
        verifymethod: analysis|inspection|test|demonstration
    }
    element name { type: ..., docref: ... }
    source - relationship -> target
```
Types: `requirement`, `functionalRequirement`, `interfaceRequirement`, `performanceRequirement`, `physicalRequirement`, `designConstraint`

Relationships: `contains`, `copies`, `derives`, `satisfies`, `verifies`, `refines`, `traces`

---

## GitGraph

```
gitgraph
    commit [id: "id"] [tag: "label"] [type: NORMAL|REVERSE|HIGHLIGHT]
    branch name [order: N]
    checkout name
    merge branch [id: "id"] [tag: "label"]
    cherry-pick id: "commit_id"
```

---

## C4 Diagrams

Keywords: `C4Context`, `C4Container`, `C4Component`, `C4Dynamic`, `C4Deployment`

```
Person(alias, label, descr)            Person_Ext(...)
System(alias, label, descr)            System_Ext(...)
Container(alias, label, techn, descr)  ContainerDb(...)  ContainerQueue(...)
Boundary(alias, label) { ... }
Rel(from, to, label, techn)            BiRel(...)
```

---

## Mindmap

```
mindmap
    root((Central Topic))
        [Square child]
        (Rounded child)
        ((Circle child))
        ))Bang child((
        )Cloud child(
        {{Hexagon child}}
```
Hierarchy by indentation. Icons: `Node::icon(fa fa-book)`

---

## Timeline

```
timeline
    title Title
    section Section Name
        2024 : Event 1
             : Event 2
```

---

## ZenUML

```
zenuml
    @Actor Alice
    @Database Bob
    Alice->Bob.method() {
        return result
    }
    if(cond) { } else { }
    try { } catch { } finally { }
    par { }
    loop { }
```

---

## Sankey (Beta)

```
sankey-beta
    source,target,value
    source2,target2,value2
```
CSV format. Config: `linkColor`, `nodeAlignment`, `showValues`, `prefix`, `suffix`

---

## XY Chart (Beta)

```
xychart-beta
    title "Title"
    x-axis ["cat1", "cat2", "cat3"]
    y-axis "Label" min --> max
    bar [v1, v2, v3]
    line [v1, v2, v3]
```
Add `horizontal` after `xychart-beta` for horizontal orientation.

**IMPORTANT:** Title and x-axis labels MUST be in double quotes if they contain non-ASCII characters (Chinese, etc.), spaces, or numbers mixed with letters. Always quote to be safe.

---

## Block Diagram (Beta)

```
block-beta
    columns N
    a["Label"]:span  b["Label"]
    block:id:width
        columns N
        ...
    end
    a --> b
```
Shapes: `[""]` square, `("")` round, `[("")]` cylinder, `((""))` circle, `{""}` diamond, `{{""}}` hexagon

---

## Packet Diagram (Beta)

```
packet-beta
    0-15: "Field Name"       Range syntax
    +16: "Field Name"        Auto-increment syntax
```
Config: `bitsPerRow` (default 32), `showBits`, `rowHeight`

---

## Kanban

```
kanban
    colId[Column Title]
        taskId[Task]@{ assigned: Name, ticket: ID, priority: High }
```
Priority: `Very High`, `High`, `Low`, `Very Low`

---

## Architecture (Beta)

```
architecture-beta
    group id(icon)[Label]
    service id(icon)[Label] in group
    junction id
    service1:Direction --> Direction:service2
```
Directions: `T`, `B`, `L`, `R`. Icons: `cloud`, `database`, `disk`, `internet`, `server`

---

## Radar Chart (Beta)

```
radar-beta
    title Title
    axis id1["Label1"], id2["Label2"], id3["Label3"]
    curve id["Name"]{v1, v2, v3}
```
Config: `max`, `min`, `ticks`, `graticule` ("circle"/"polygon")

---

## Treemap (Beta)

```
treemap-beta
    "Parent"
        "Child": value
        "Child Group"
            "Grandchild": value
```
Config: `showValues`, `valueFormat`, `padding`
