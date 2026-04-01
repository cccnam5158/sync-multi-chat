# openpyxl API Reference

## Workbook

```python
from openpyxl import Workbook, load_workbook

wb = Workbook()                                      # New
wb = load_workbook("file.xlsx")                      # Open
wb = load_workbook("file.xlsx", data_only=True)      # Values only (no formulas)
wb = load_workbook("file.xlsx", read_only=True)      # Read-only (memory efficient)
wb.save("output.xlsx")
wb.close()
```

## Worksheet

```python
ws = wb.active                          # Active sheet
ws = wb["Sheet1"]                       # By name
ws = wb.create_sheet("New Sheet")       # Create
ws = wb.create_sheet("New", 0)          # Create at position
del wb["Sheet1"]                        # Delete
wb.sheetnames                           # List sheet names

ws.title = "Renamed"                    # Rename
ws.max_row                              # Last row with data
ws.max_column                           # Last column with data
```

## Cells

```python
# Access
cell = ws["A1"]
cell = ws.cell(row=1, column=1)

# Value
cell.value = "text"
cell.value = 42
cell.value = 3.14
cell.value = datetime.now()
cell.value = "=SUM(A1:A10)"  # Formula

# Read
print(cell.value)
print(cell.coordinate)  # "A1"
print(cell.row)          # 1
print(cell.column)       # 1
```

## Ranges

```python
# Iterate rows
for row in ws.iter_rows(min_row=1, max_row=10, min_col=1, max_col=5, values_only=True):
    print(row)  # tuple of values

# Iterate columns
for col in ws.iter_cols(min_row=1, max_row=10, min_col=1, max_col=5, values_only=True):
    print(col)

# Append row
ws.append(["A", "B", "C"])

# Insert/delete
ws.insert_rows(2, amount=3)   # Insert 3 rows before row 2
ws.delete_rows(5, amount=2)   # Delete 2 rows starting at row 5
ws.insert_cols(3)              # Insert column before column C
ws.delete_cols(3)              # Delete column C

# Merge/unmerge
ws.merge_cells("A1:D1")
ws.unmerge_cells("A1:D1")
```

## Styling

```python
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill

# Font
cell.font = Font(
    name="Arial",
    size=12,
    bold=True,
    italic=True,
    underline="single",       # "single", "double"
    color="FF0000",
)

# Alignment
cell.alignment = Alignment(
    horizontal="center",      # "left", "center", "right", "justify"
    vertical="center",        # "top", "center", "bottom"
    wrap_text=True,
    text_rotation=45,
)

# Fill
cell.fill = PatternFill(
    start_color="4472C4",
    end_color="4472C4",
    fill_type="solid",
)

# Border
thin = Side(border_style="thin", color="000000")
cell.border = Border(top=thin, bottom=thin, left=thin, right=thin)

# Number format
cell.number_format = "#,##0.00"
```

## Column/Row dimensions

```python
from openpyxl.utils import get_column_letter

# Column width
ws.column_dimensions["A"].width = 20
ws.column_dimensions[get_column_letter(3)].width = 15

# Row height
ws.row_dimensions[1].height = 30

# Hide column/row
ws.column_dimensions["B"].hidden = True
ws.row_dimensions[5].hidden = True
```

## Charts

```python
from openpyxl.chart import BarChart, LineChart, PieChart, Reference

chart = BarChart()
chart.title = "Title"
chart.x_axis.title = "X"
chart.y_axis.title = "Y"
chart.width = 15         # cm
chart.height = 10        # cm

data = Reference(ws, min_col=2, max_col=4, min_row=1, max_row=10)
cats = Reference(ws, min_col=1, min_row=2, max_row=10)
chart.add_data(data, titles_from_data=True)
chart.set_categories(cats)
ws.add_chart(chart, "F2")  # Anchor cell
```

## Common formulas

```python
ws["A1"] = "=SUM(B1:B10)"
ws["A2"] = "=AVERAGE(B1:B10)"
ws["A3"] = "=COUNT(B1:B10)"
ws["A4"] = "=MAX(B1:B10)"
ws["A5"] = "=MIN(B1:B10)"
ws["A6"] = '=IF(B1>100,"High","Low")'
ws["A7"] = "=VLOOKUP(B1,Sheet2!A:B,2,FALSE)"
ws["A8"] = '=SUMIF(A1:A10,"Widget",B1:B10)'
ws["A9"] = "=ROUND(B1,2)"
ws["A10"] = '=CONCATENATE(A1," ",B1)'
```

## Utilities

```python
from openpyxl.utils import get_column_letter, column_index_from_string

get_column_letter(3)               # "C"
column_index_from_string("C")      # 3

# Cell coordinate helpers
from openpyxl.utils.cell import coordinate_from_string, column_index_from_string
coordinate_from_string("A1")       # ("A", 1)
```

## pandas integration

```python
import pandas as pd
from openpyxl import load_workbook

# Read
df = pd.read_excel("file.xlsx", sheet_name="Sheet1", engine="openpyxl")

# Write with formatting
with pd.ExcelWriter("output.xlsx", engine="openpyxl") as writer:
    df.to_excel(writer, sheet_name="Data", index=False)

    # Access workbook for formatting
    wb = writer.book
    ws = writer.sheets["Data"]
    # Apply formatting...
```
