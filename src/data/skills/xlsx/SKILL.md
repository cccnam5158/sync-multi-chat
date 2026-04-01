---
name: xlsx
description: Excel spreadsheet processing — reading, creating with openpyxl, formula-based workflows, charts, formatting, pandas integration, CSV conversion.
---

# Excel Spreadsheet (XLSX) Processing

When the user needs to read, create, or edit Excel files, follow this guide.

## 1. Reading XLSX files

### Quick data overview

Use the `read` tool directly — it natively extracts spreadsheet data:

```
read(file_path="data.xlsx")
```

Returns tab-separated data per sheet. Good for quick overview.

### Detailed access with openpyxl

```python
from openpyxl import load_workbook

wb = load_workbook("data.xlsx", data_only=True)

for sheet_name in wb.sheetnames:
    ws = wb[sheet_name]
    print(f"\n=== {sheet_name} ===")
    print(f"Rows: {ws.max_row}, Columns: {ws.max_column}")

    for row in ws.iter_rows(values_only=True):
        print(row)
```

### With pandas (for analysis)

```python
import pandas as pd

# Read single sheet
df = pd.read_excel("data.xlsx")

# Read specific sheet
df = pd.read_excel("data.xlsx", sheet_name="Sales")

# Read all sheets
dfs = pd.read_excel("data.xlsx", sheet_name=None)
for name, df in dfs.items():
    print(f"\n{name}: {df.shape}")
    print(df.head())
```

## 2. Creating XLSX files

### Core principle: Use formulas, not hardcoded values

Always use Excel formulas instead of calculating in Python and inserting results. This keeps spreadsheets dynamic and updatable.

```python
# Good: formula-based
ws["C2"] = "=A2*B2"

# Bad: hardcoded
ws["C2"] = 150  # calculated externally
```

### Basic spreadsheet

```python
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from openpyxl.utils import get_column_letter

wb = Workbook()
ws = wb.active
ws.title = "Sales Data"

# Headers
headers = ["Product", "Q1", "Q2", "Q3", "Q4", "Total"]
for col, header in enumerate(headers, 1):
    cell = ws.cell(row=1, column=col, value=header)
    cell.font = Font(bold=True, size=12)
    cell.fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    cell.font = Font(bold=True, color="FFFFFF")
    cell.alignment = Alignment(horizontal="center")

# Data
data = [
    ["Widget A", 1200, 1350, 1100, 1500],
    ["Widget B", 800, 950, 1200, 1100],
    ["Widget C", 2000, 1800, 2200, 2400],
]

for row_idx, row_data in enumerate(data, 2):
    for col_idx, value in enumerate(row_data, 1):
        ws.cell(row=row_idx, column=col_idx, value=value)
    # Total formula
    ws.cell(row=row_idx, column=6, value=f"=SUM(B{row_idx}:E{row_idx})")

# Summary row
last_data_row = len(data) + 1
summary_row = last_data_row + 1
ws.cell(row=summary_row, column=1, value="Total")
ws.cell(row=summary_row, column=1).font = Font(bold=True)
for col in range(2, 7):
    col_letter = get_column_letter(col)
    ws.cell(row=summary_row, column=col,
            value=f"=SUM({col_letter}2:{col_letter}{last_data_row})")

# Column widths
ws.column_dimensions["A"].width = 15
for col in range(2, 7):
    ws.column_dimensions[get_column_letter(col)].width = 12

wb.save("sales.xlsx")
```

### Number formatting

```python
from openpyxl.styles import numbers

# Currency
cell.number_format = '$#,##0.00'

# Percentage
cell.number_format = '0.0%'

# Date
cell.number_format = 'YYYY-MM-DD'

# Thousands separator
cell.number_format = '#,##0'

# Custom: negative in parentheses
cell.number_format = '#,##0;(#,##0)'
```

### Professional formatting standards

| Element | Convention |
|---------|-----------|
| Currency | `$#,##0` with units in headers |
| Percentages | `0.0%` format |
| Negative numbers | Parentheses `(1,234)`, not minus signs |
| Zero values | Display as "-" |
| Years | Text strings `"2024"`, not numbers |
| Headers | Bold, colored background, centered |

### Color coding for financial models

| Color | Meaning |
|-------|---------|
| Blue text | Hardcoded inputs / user-changeable numbers |
| Black text | Formulas and calculations |
| Green text | Cross-sheet links |
| Red text | External file links |
| Yellow background | Key assumptions requiring attention |

## 3. Charts

```python
from openpyxl.chart import BarChart, LineChart, PieChart, Reference

# Bar chart
chart = BarChart()
chart.title = "Quarterly Sales"
chart.x_axis.title = "Product"
chart.y_axis.title = "Revenue ($)"

data = Reference(ws, min_col=2, max_col=5, min_row=1, max_row=4)
cats = Reference(ws, min_col=1, min_row=2, max_row=4)
chart.add_data(data, titles_from_data=True)
chart.set_categories(cats)
chart.shape = 4  # Clustered bar
ws.add_chart(chart, "H2")

# Line chart
line = LineChart()
line.title = "Trend"
line.add_data(data, titles_from_data=True)
line.set_categories(cats)
ws.add_chart(line, "H18")

# Pie chart
pie = PieChart()
pie.title = "Q1 Distribution"
pie_data = Reference(ws, min_col=2, max_col=2, min_row=1, max_row=4)
pie.add_data(pie_data, titles_from_data=True)
pie.set_categories(cats)
ws.add_chart(pie, "H34")
```

## 4. Common operations

### Merge cells

```python
ws.merge_cells("A1:D1")
ws["A1"] = "Merged Header"
```

### Freeze panes

```python
ws.freeze_panes = "A2"   # Freeze first row
ws.freeze_panes = "B2"   # Freeze first row and first column
```

### Auto-filter

```python
ws.auto_filter.ref = "A1:F4"
```

### Conditional formatting

```python
from openpyxl.formatting.rule import CellIsRule

# Highlight cells > 2000 in green
green_fill = PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid")
ws.conditional_formatting.add(
    "B2:E4",
    CellIsRule(operator="greaterThan", formula=["2000"], fill=green_fill)
)
```

### Multiple sheets

```python
wb = Workbook()
ws1 = wb.active
ws1.title = "Summary"

ws2 = wb.create_sheet("Details")
ws3 = wb.create_sheet("Raw Data")

# Cross-sheet formula
ws1["A1"] = "=Details!A1"
```

## 5. CSV / TSV conversion

### XLSX to CSV

```python
import pandas as pd

df = pd.read_excel("data.xlsx")
df.to_csv("data.csv", index=False, encoding="utf-8-sig")
```

### CSV to XLSX

```python
import pandas as pd

df = pd.read_csv("data.csv")
df.to_excel("data.xlsx", index=False, sheet_name="Data")
```

## 6. Editing existing files

```python
from openpyxl import load_workbook

wb = load_workbook("existing.xlsx")
ws = wb["Sheet1"]

# Modify cell
ws["A1"] = "New Value"

# Insert row
ws.insert_rows(2)

# Delete row
ws.delete_rows(5)

# Append data
ws.append(["New", "Row", "Data"])

wb.save("modified.xlsx")
```

## 7. Dependencies

Core (included with Muse):
- `openpyxl` — read, create, edit, charts, formatting

Optional (install as needed):
- `pandas` — data analysis: `pip install pandas`
