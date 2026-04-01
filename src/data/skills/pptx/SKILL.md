---
name: pptx
description: PowerPoint presentation processing — reading, creating with python-pptx, slide layouts, text/images/charts, editing via XML, design principles.
---

# PowerPoint Presentation (PPTX) Processing

When the user needs to read, create, or edit PowerPoint files, follow this guide.

For content design and storytelling guidance, also load the `presentation` skill.

## 1. Reading PPTX files

### Quick text extraction

Use the `read` tool directly — it natively extracts slide text:

```
read(file_path="deck.pptx")
```

Returns slide-by-slide text content including table data.

### Detailed access

```python
from pptx import Presentation

prs = Presentation("deck.pptx")

for i, slide in enumerate(prs.slides, 1):
    print(f"\n=== Slide {i} ===")
    print(f"Layout: {slide.slide_layout.name}")
    for shape in slide.shapes:
        print(f"  Shape: {shape.shape_type}, Name: {shape.name}")
        if shape.has_text_frame:
            for para in shape.text_frame.paragraphs:
                print(f"    Text: {para.text}")
        if shape.has_table:
            for row in shape.table.rows:
                print(f"    Table row: {[cell.text for cell in row.cells]}")

# Slide dimensions
print(f"Width: {prs.slide_width}, Height: {prs.slide_height}")
```

## 2. Creating presentations

### Basic presentation

```python
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor

prs = Presentation()

# Slide size (16:9 widescreen)
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

# --- Title slide ---
layout = prs.slide_layouts[0]  # Title Slide
slide = prs.slides.add_slide(layout)
slide.shapes.title.text = "Quarterly Review"
slide.placeholders[1].text = "Q3 2025 Results"

# --- Content slide ---
layout = prs.slide_layouts[1]  # Title and Content
slide = prs.slides.add_slide(layout)
slide.shapes.title.text = "Key Highlights"

body = slide.placeholders[1]
tf = body.text_frame
tf.text = "Revenue grew 15% year-over-year"

p = tf.add_paragraph()
p.text = "Operating margins improved to 22%"
p.level = 0

p = tf.add_paragraph()
p.text = "New customer acquisitions up 30%"
p.level = 0

prs.save("quarterly.pptx")
```

### Slide layouts

Standard slide layouts (by index):

| Index | Name | Use case |
|-------|------|----------|
| 0 | Title Slide | First slide |
| 1 | Title and Content | Main content |
| 2 | Section Header | Section divider |
| 3 | Two Content | Side-by-side |
| 4 | Comparison | Compare two items |
| 5 | Title Only | Custom layout |
| 6 | Blank | Fully custom |

### Text formatting

```python
from pptx.util import Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

# Paragraph alignment
para.alignment = PP_ALIGN.CENTER

# Run formatting
run = para.add_run()
run.text = "Bold red text"
run.font.bold = True
run.font.size = Pt(24)
run.font.color.rgb = RGBColor(0xFF, 0x00, 0x00)
run.font.name = "Arial"
run.font.italic = True
run.font.underline = True
```

### Adding shapes

```python
from pptx.util import Inches, Pt
from pptx.enum.shapes import MSO_SHAPE

slide = prs.slides.add_slide(prs.slide_layouts[6])  # Blank

# Text box
from pptx.util import Inches
txBox = slide.shapes.add_textbox(Inches(1), Inches(1), Inches(5), Inches(1.5))
tf = txBox.text_frame
tf.word_wrap = True
p = tf.paragraphs[0]
p.text = "This is a text box"
p.font.size = Pt(18)

# Rectangle
shape = slide.shapes.add_shape(
    MSO_SHAPE.RECTANGLE,
    Inches(1), Inches(3), Inches(3), Inches(1.5)
)
shape.text = "Rectangle"
shape.fill.solid()
shape.fill.fore_color.rgb = RGBColor(0x44, 0x72, 0xC4)

# Rounded rectangle
shape = slide.shapes.add_shape(
    MSO_SHAPE.ROUNDED_RECTANGLE,
    Inches(5), Inches(3), Inches(3), Inches(1.5)
)
shape.text = "Rounded"
```

### Images

```python
slide.shapes.add_picture(
    "chart.png",
    Inches(1), Inches(2),       # left, top
    width=Inches(5),            # auto-height to preserve ratio
)

# Or specify both dimensions
slide.shapes.add_picture(
    "logo.png",
    Inches(0.5), Inches(0.5),
    width=Inches(2), height=Inches(1),
)
```

### Tables

```python
rows, cols = 4, 3
table_shape = slide.shapes.add_table(rows, cols, Inches(1), Inches(2), Inches(8), Inches(3))
table = table_shape.table

# Set column widths
table.columns[0].width = Inches(3)
table.columns[1].width = Inches(2.5)
table.columns[2].width = Inches(2.5)

# Headers
headers = ["Product", "Revenue", "Growth"]
for i, header in enumerate(headers):
    cell = table.cell(0, i)
    cell.text = header
    for para in cell.text_frame.paragraphs:
        para.font.bold = True
        para.font.size = Pt(14)

# Data
data = [
    ["Widget A", "$1.2M", "+15%"],
    ["Widget B", "$800K", "+8%"],
    ["Widget C", "$2.1M", "+22%"],
]
for row_idx, row_data in enumerate(data, 1):
    for col_idx, value in enumerate(row_data):
        table.cell(row_idx, col_idx).text = value
```

### Charts

```python
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE

chart_data = CategoryChartData()
chart_data.categories = ["Q1", "Q2", "Q3", "Q4"]
chart_data.add_series("Revenue", (1200, 1350, 1100, 1500))
chart_data.add_series("Profit", (300, 400, 280, 450))

chart = slide.shapes.add_chart(
    XL_CHART_TYPE.COLUMN_CLUSTERED,
    Inches(1), Inches(2),
    Inches(8), Inches(4),
    chart_data,
).chart

chart.has_legend = True
chart.legend.include_in_layout = False
```

## 3. Editing existing presentations

### Simple modifications

```python
from pptx import Presentation

prs = Presentation("existing.pptx")

# Modify text
for slide in prs.slides:
    for shape in slide.shapes:
        if shape.has_text_frame:
            for para in shape.text_frame.paragraphs:
                for run in para.runs:
                    if "OLD" in run.text:
                        run.text = run.text.replace("OLD", "NEW")

# Delete a slide
rId = prs.slides._sldIdLst[2].get("r:id")  # 3rd slide (0-indexed)
prs.part.drop_rel(rId)
del prs.slides._sldIdLst[2]

prs.save("modified.pptx")
```

### XML-level editing (advanced)

PPTX files are ZIP archives. For complex edits, unpack → modify XML → repack:

```python
import zipfile
import os

def unpack_pptx(pptx_path, output_dir):
    with zipfile.ZipFile(pptx_path, "r") as z:
        z.extractall(output_dir)

def pack_pptx(input_dir, pptx_path):
    with zipfile.ZipFile(pptx_path, "w", zipfile.ZIP_DEFLATED) as z:
        for root, dirs, files in os.walk(input_dir):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, input_dir)
                z.write(file_path, arcname)
```

### Key XML files in a PPTX

| Path | Content |
|------|---------|
| `ppt/presentation.xml` | Main presentation structure |
| `ppt/slides/slide1.xml` | Individual slide content |
| `ppt/slideLayouts/` | Slide layout templates |
| `ppt/slideMasters/` | Slide master templates |
| `ppt/theme/theme1.xml` | Theme (colors, fonts) |
| `ppt/media/` | Images and media files |

## 4. Design principles

### Slide design best practices

- **One message per slide** — each slide should convey a single key point
- **6x6 rule** — max 6 bullet points, max 6 words per bullet
- **Conclusion-driven titles** — "Revenue grew 15%" not "Revenue Overview"
- **Consistent spacing** — maintain uniform margins (min 0.5 inch)
- **Visual variety** — vary layouts to keep audience engaged
- **High contrast** — ensure text is readable against backgrounds

### Color palette suggestions

| Style | Colors |
|-------|--------|
| Business | Navy #003366, Gray #666666, Accent #0066CC |
| Tech | Dark #1A1A2E, Teal #16213E, Accent #0F3460 |
| Creative | Coral #FF6B6B, Teal #4ECDC4, Cream #F7FFF7 |
| Minimal | Black #000000, White #FFFFFF, Gray #CCCCCC |

## 5. Dependencies

Core (included with Muse):
- `python-pptx` — read, create, edit presentations

Optional:
- `Pillow` — image processing: `pip install Pillow`
