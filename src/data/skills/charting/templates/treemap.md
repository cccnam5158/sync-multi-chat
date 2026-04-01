# Treemap Templates (Beta)

## Revenue Breakdown

```mermaid
treemap-beta
    "Revenue"
        "Products"
            "Electronics": 45
            "Clothing": 30
            "Books": 15
        "Services"
            "Consulting": 25
            "Support": 20
            "Training": 10
```

## Disk Usage

```mermaid
treemap-beta
    "Disk Usage (GB)"
        "System"
            "OS": 30
            "Apps": 15
        "User Data"
            "Documents": 45
            "Photos": 80
            "Videos": 120
            "Music": 25
        "Cache"
            "Browser": 5
            "App Cache": 8
```

## Key Syntax

- `treemap-beta` - Declaration keyword (beta suffix required)
- **Parent nodes**: `"Section Name"` (no value, acts as container)
- **Leaf nodes**: `"Leaf Name": numericValue`
- **Hierarchy**: Created through indentation
- Config: `showValues`, `valueFormat` (D3 format like "$,.0f"), `padding`, `labelFontSize`
