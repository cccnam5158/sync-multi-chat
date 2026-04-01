# python-pptx API Reference

## Presentation

```python
from pptx import Presentation

prs = Presentation()                # New (default template)
prs = Presentation("template.pptx") # From template
prs.save("output.pptx")

# Slide size
prs.slide_width   # EMU
prs.slide_height  # EMU

# Standard sizes
from pptx.util import Inches
prs.slide_width = Inches(13.333)  # 16:9
prs.slide_height = Inches(7.5)
prs.slide_width = Inches(10)     # 4:3
prs.slide_height = Inches(7.5)
```

## Slides

```python
# Add slide
layout = prs.slide_layouts[1]  # Title and Content
slide = prs.slides.add_slide(layout)

# Access slides
for slide in prs.slides:
    print(slide.slide_id)

# Slide count
len(prs.slides)
```

## Shapes

```python
# All shapes on a slide
for shape in slide.shapes:
    print(shape.shape_type)
    print(shape.name)
    print(shape.left, shape.top, shape.width, shape.height)

# Placeholders
for ph in slide.placeholders:
    print(ph.placeholder_format.idx, ph.name)

# Title
slide.shapes.title.text = "Title"

# Content placeholder
body = slide.placeholders[1]
```

## Text frames

```python
tf = shape.text_frame

# Properties
tf.word_wrap = True
tf.auto_size = MSO_AUTO_SIZE.SHAPE_TO_FIT_TEXT

# Margins
tf.margin_left = Inches(0.1)
tf.margin_right = Inches(0.1)
tf.margin_top = Inches(0.05)
tf.margin_bottom = Inches(0.05)

# Paragraphs
para = tf.paragraphs[0]  # First paragraph
para = tf.add_paragraph() # Add new

# Runs
run = para.runs[0]
run = para.add_run()
run.text = "Hello"
```

## Font properties

```python
from pptx.util import Pt
from pptx.dml.color import RGBColor

run.font.name = "Arial"
run.font.size = Pt(18)
run.font.bold = True
run.font.italic = True
run.font.underline = True
run.font.color.rgb = RGBColor(0xFF, 0x00, 0x00)
```

## Paragraph properties

```python
from pptx.enum.text import PP_ALIGN
from pptx.util import Pt

para.alignment = PP_ALIGN.CENTER  # LEFT, CENTER, RIGHT, JUSTIFY
para.level = 0  # Indent level (0-8)
para.space_before = Pt(6)
para.space_after = Pt(6)
para.line_spacing = 1.5  # Multiplier
```

## Shapes

```python
from pptx.enum.shapes import MSO_SHAPE
from pptx.util import Inches

# Add shapes
slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, height)
slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
slide.shapes.add_shape(MSO_SHAPE.OVAL, left, top, width, height)
slide.shapes.add_shape(MSO_SHAPE.CHEVRON, left, top, width, height)

# Text box
slide.shapes.add_textbox(left, top, width, height)

# Image
slide.shapes.add_picture("image.png", left, top, width=None, height=None)

# Table
slide.shapes.add_table(rows, cols, left, top, width, height)

# Connector
slide.shapes.add_connector(MSO_CONNECTOR_TYPE.STRAIGHT, begin_x, begin_y, end_x, end_y)
```

## Fill

```python
shape.fill.solid()
shape.fill.fore_color.rgb = RGBColor(0x44, 0x72, 0xC4)
shape.fill.background()  # No fill

# Gradient
shape.fill.gradient()
shape.fill.gradient_stops[0].color.rgb = RGBColor(0x00, 0x00, 0xFF)
shape.fill.gradient_stops[0].position = 0.0
```

## Line

```python
shape.line.color.rgb = RGBColor(0x00, 0x00, 0x00)
shape.line.width = Pt(1.5)
shape.line.dash_style = MSO_LINE_DASH_STYLE.DASH
shape.line.fill.background()  # No line
```

## Tables

```python
table = table_shape.table

# Cell access
cell = table.cell(row, col)
cell.text = "Value"

# Merge cells
cell_a = table.cell(0, 0)
cell_b = table.cell(0, 2)
cell_a.merge(cell_b)

# Column width / row height
table.columns[0].width = Inches(2)
table.rows[0].height = Inches(0.5)
```

## Charts

```python
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE

chart_data = CategoryChartData()
chart_data.categories = ["A", "B", "C"]
chart_data.add_series("Series 1", (1, 2, 3))

chart_frame = slide.shapes.add_chart(
    XL_CHART_TYPE.COLUMN_CLUSTERED,  # BAR_CLUSTERED, LINE, PIE, etc.
    Inches(1), Inches(2),
    Inches(8), Inches(4),
    chart_data,
)

chart = chart_frame.chart
chart.has_legend = True
chart.has_title = True
chart.chart_title.text_frame.text = "Chart Title"
```

## Units

```python
from pptx.util import Inches, Cm, Pt, Emu

# 1 inch = 914400 EMU
# 1 cm = 360000 EMU
# 1 point = 12700 EMU
```

## Notes

```python
# Add speaker notes
notes_slide = slide.notes_slide
notes_tf = notes_slide.notes_text_frame
notes_tf.text = "Speaker notes here"
```
