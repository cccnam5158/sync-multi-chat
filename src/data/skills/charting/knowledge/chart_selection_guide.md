# Chart Selection Guide

## Quick Decision Matrix

| Question to Ask | Recommended Diagram |
|----------------|---------------------|
| How does this process flow? | **Flowchart** |
| How do components interact over time? | **Sequence Diagram** or **ZenUML** |
| What are the object relationships? | **Class Diagram** |
| What states can this entity be in? | **State Diagram** |
| What's the database structure? | **ER Diagram** |
| What's the user experience like? | **User Journey** |
| What's the project schedule? | **Gantt Chart** |
| What's the proportional breakdown? | **Pie Chart** |
| How do items compare on 2 dimensions? | **Quadrant Chart** |
| What are the system requirements? | **Requirement Diagram** |
| What's the git branching strategy? | **GitGraph** |
| What's the system architecture (C4)? | **C4 Diagram** |
| How are ideas/topics organized? | **Mindmap** |
| What happened over time? | **Timeline** |
| How does resource/value flow? | **Sankey** |
| What are the numeric trends? | **XY Chart** |
| What's the system layout? | **Block Diagram** or **Architecture** |
| What's the protocol/packet format? | **Packet Diagram** |
| What's the task board status? | **Kanban** |
| How do items compare on multiple dimensions? | **Radar Chart** |
| What's the hierarchical proportion? | **Treemap** |

## Detailed Guidance by Category

### Process & Flow Diagrams

**Flowchart** - Step-by-step processes with decision points, algorithms, approval workflows. Use when logic has branches.

**Sequence Diagram / ZenUML** - Multi-party interactions over time. API calls, auth flows, microservice communication. Use ZenUML for Java/OOP-style syntax preference.

**State Diagram** - Lifecycle stages of an entity (order states, connection states, UI modes). Use when an entity has distinct named states.

**User Journey** - User experience mapping with satisfaction scores per step. Use for UX analysis and identifying pain points.

### Structural Diagrams

**Class Diagram** - Object-oriented design, interfaces, inheritance, composition. Use for code architecture documentation.

**ER Diagram** - Database schemas with tables, columns, and relationships. Use for data modeling.

**C4 Diagram** - Multi-level architecture views (Context → Container → Component → Code). Use for system documentation at different zoom levels.

**Architecture Diagram** - Infrastructure layout with groups, services, and connections. Use for cloud/deployment architecture.

**Block Diagram** - General-purpose block layout with columns. Use for simple system overviews.

### Data Visualization

**Pie Chart** - Proportional breakdown (max 7 segments). Use for distributions where parts sum to a whole.

**XY Chart** - Bar and line charts with numeric data. Use for trends, comparisons, time series.

**Quadrant Chart** - Plot items on 2 dimensions (e.g., urgency vs importance). Use for prioritization matrices.

**Sankey** - Flow of quantities between nodes. Use for budget flows, energy flows, user conversion funnels.

**Radar Chart** - Multi-axis comparison of items. Use for skills assessments, feature comparisons, team evaluations.

**Treemap** - Hierarchical proportional data. Use for budget breakdowns, disk usage, organizational structures with values.

### Project & Planning

**Gantt Chart** - Project timelines with tasks, dependencies, and milestones. Use for scheduling.

**Kanban** - Task boards with columns (Todo, In Progress, Done). Use for sprint tracking, workflow visibility.

**Timeline** - Historical events or milestones. Use for company history, product roadmaps.

### Specialized

**GitGraph** - Git branching and merge visualization. Use for documenting branching strategies.

**Requirement Diagram** - System requirements with traceability. Use for formal requirement documentation.

**Packet Diagram** - Network protocol field layouts. Use for documenting binary protocols, network headers.

**Mindmap** - Brainstorming and topic hierarchies. Use for ideation, feature breakdowns, knowledge organization.

## Tips for Effective Diagrams

1. **One concept per diagram** - Don't try to show everything
2. **15-20 nodes max** - Split complex systems into focused diagrams
3. **Meaningful labels** - Short but descriptive
4. **Consistent direction** - TD for hierarchies, LR for timelines
5. **Use subgraphs/groups** - Group related elements
6. **Color sparingly** - Only to highlight important paths or states
7. **Choose the simplest type** - Don't use a complex diagram when a simple one works
