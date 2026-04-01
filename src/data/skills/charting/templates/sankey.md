# Sankey Diagram Templates

## Basic Energy Flow

```mermaid
sankey-beta
    Electricity,Residential,30
    Electricity,Commercial,25
    Electricity,Industrial,45
    Natural Gas,Residential,20
    Natural Gas,Commercial,15
    Natural Gas,Industrial,35
    Renewable,Electricity,40
    Fossil Fuel,Electricity,60
```

## Budget Flow

```mermaid
sankey-beta
    Revenue,Product Sales,60
    Revenue,Services,30
    Revenue,Subscriptions,10
    Product Sales,COGS,25
    Product Sales,Gross Profit,35
    Services,COGS,10
    Services,Gross Profit,20
    Subscriptions,Gross Profit,10
    Gross Profit,R&D,20
    Gross Profit,Marketing,15
    Gross Profit,Operations,10
    Gross Profit,Net Income,20
```

## Key Syntax

- `sankey-beta` - Declaration keyword
- CSV format: `source,target,value` (one per line)
- Empty lines allowed for spacing
- Use quoted strings for commas: `"Node, A",NodeB,100`
- Configuration options: `width`, `height`, `linkColor` ("gradient"/"source"/"target"/hex), `nodeAlignment` ("justify"/"left"/"right"/"center"), `showValues`, `prefix`, `suffix`
