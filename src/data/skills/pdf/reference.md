# PDF Library Reference

## pypdf

### Reading

```python
from pypdf import PdfReader

reader = PdfReader("file.pdf")
print(f"Pages: {len(reader.pages)}")
print(f"Metadata: {reader.metadata}")

# Extract text from all pages
for page in reader.pages:
    text = page.extract_text()
```

### Writing

```python
from pypdf import PdfWriter

writer = PdfWriter()
writer.add_blank_page(width=612, height=792)  # US Letter
writer.append("existing.pdf")                  # Append file
writer.add_page(reader.pages[0])               # Add single page
writer.write("output.pdf")
writer.close()
```

### Page operations

```python
page.rotate(90)                    # Rotate clockwise
page.merge_page(overlay_page)     # Overlay another page
page.scale(0.5, 0.5)              # Scale to 50%
page.compress_content_streams()   # Compress
```

### Form fields

```python
# Read fields
fields = reader.get_fields()
for name, field in fields.items():
    print(f"{name}: {field.get('/V', 'empty')}")

# Fill fields
writer = PdfWriter()
writer.append(reader)
writer.update_page_form_field_values(
    writer.pages[0],
    {"field_name": "value"},
)
```

### Encryption

```python
writer.encrypt("user_pass", "owner_pass")
reader = PdfReader("encrypted.pdf", password="user_pass")
```

---

## pdfplumber

### Text extraction with layout

```python
import pdfplumber

with pdfplumber.open("file.pdf") as pdf:
    for page in pdf.pages:
        # Plain text
        text = page.extract_text()

        # Text with layout preserved
        text = page.extract_text(layout=True)

        # Words with coordinates
        words = page.extract_words()
        # Each word: {'text': '...', 'x0': ..., 'top': ..., 'x1': ..., 'bottom': ...}
```

### Table extraction

```python
with pdfplumber.open("file.pdf") as pdf:
    page = pdf.pages[0]

    # Extract all tables
    tables = page.extract_tables()
    for table in tables:
        for row in table:
            print(row)  # list of cell values

    # Convert to pandas DataFrame
    import pandas as pd
    table = page.extract_tables()[0]
    df = pd.DataFrame(table[1:], columns=table[0])
```

### Page properties

```python
page.width       # Page width in points
page.height      # Page height in points
page.page_number # 1-based page number
page.images      # List of images on the page
page.lines       # List of line elements
page.rects       # List of rectangle elements
```

---

## reportlab

### Canvas (low-level)

```python
from reportlab.lib.pagesizes import A4, letter
from reportlab.pdfgen import canvas

c = canvas.Canvas("output.pdf", pagesize=A4)
w, h = A4

# Text
c.setFont("Helvetica", 12)
c.drawString(72, h - 72, "Hello")           # Left-aligned
c.drawRightString(w - 72, h - 72, "Right")  # Right-aligned
c.drawCentredString(w / 2, h - 72, "Center")

# Shapes
c.setStrokeColor(colors.black)
c.setFillColor(colors.lightgrey)
c.rect(72, h - 200, 200, 100, fill=1)       # Rectangle
c.circle(300, h - 150, 50, fill=1)           # Circle
c.line(72, h - 220, w - 72, h - 220)        # Line

# Images
c.drawImage("logo.png", 72, h - 400, width=200, height=100)

# New page
c.showPage()
c.save()
```

### Platypus (high-level)

```python
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image, PageBreak, ListFlowable, ListItem,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch, cm

doc = SimpleDocTemplate("output.pdf", pagesize=A4,
    topMargin=72, bottomMargin=72,
    leftMargin=72, rightMargin=72)

styles = getSampleStyleSheet()
story = []

# Heading
story.append(Paragraph("Title", styles["Title"]))

# Body text
story.append(Paragraph("Body text here.", styles["Normal"]))
story.append(Spacer(1, 12))

# Bullet list
story.append(ListFlowable([
    ListItem(Paragraph("Item 1", styles["Normal"])),
    ListItem(Paragraph("Item 2", styles["Normal"])),
], bulletType="bullet"))

# Table
data = [["A", "B"], ["1", "2"]]
t = Table(data, colWidths=[2 * inch, 2 * inch])
t.setStyle(TableStyle([
    ("GRID", (0, 0), (-1, -1), 1, colors.black),
    ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
]))
story.append(t)

# Page break
story.append(PageBreak())

doc.build(story)
```

### Common page sizes

| Name | Points | Inches |
|------|--------|--------|
| A4 | 595.28 x 841.89 | 8.27 x 11.69 |
| letter | 612 x 792 | 8.5 x 11 |
| legal | 612 x 1008 | 8.5 x 14 |

### Units

```python
from reportlab.lib.units import inch, cm, mm
# 1 inch = 72 points
# 1 cm = 28.35 points
```
