---
name: pdf
description: PDF document processing — reading, creating, table extraction, merging/splitting, form handling, watermarking, encryption.
---

# PDF Document Processing

When the user needs to read, create, or manipulate PDF files, follow this guide.

## 1. Reading PDFs

### Quick text extraction

Use the `read` tool directly — it natively extracts text from PDF files:

```
read(file_path="report.pdf")
```

This returns page-by-page text content. Sufficient for most reading tasks.

### Table extraction (advanced)

For structured table data, use `pdfplumber` via a Python script:

```python
import pdfplumber

with pdfplumber.open("report.pdf") as pdf:
    for page in pdf.pages:
        tables = page.extract_tables()
        for table in tables:
            for row in table:
                print(row)
```

Run this directly with `code_execute`. Only use `write` + `bash` if you need to save the script for reuse.

### Image-based / scanned PDFs

If `read` returns "(No text content)", the PDF is likely image-based. Use OCR:

```python
# Requires: pip install pytesseract pdf2image
from pdf2image import convert_from_path
import pytesseract

images = convert_from_path("scanned.pdf")
for i, img in enumerate(images, 1):
    text = pytesseract.image_to_string(img, lang="chi_sim+eng")
    print(f"--- Page {i} ---")
    print(text)
```

## 2. Creating PDFs

### Simple text PDFs with reportlab

```python
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

c = canvas.Canvas("output.pdf", pagesize=A4)
width, height = A4

c.setFont("Helvetica", 12)
c.drawString(72, height - 72, "Hello, World!")
c.save()
```

### Structured documents with Platypus

For multi-page documents with paragraphs, tables, and images:

```python
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.units import inch

doc = SimpleDocTemplate("report.pdf", pagesize=A4)
styles = getSampleStyleSheet()
story = []

# Title
story.append(Paragraph("Quarterly Report", styles["Title"]))
story.append(Spacer(1, 12))

# Body text
story.append(Paragraph("This is the report content.", styles["Normal"]))
story.append(Spacer(1, 12))

# Table
data = [
    ["Quarter", "Revenue", "Growth"],
    ["Q1", "$1.2M", "+5%"],
    ["Q2", "$1.4M", "+17%"],
]
table = Table(data, colWidths=[1.5 * inch, 1.5 * inch, 1.5 * inch])
table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
    ("GRID", (0, 0), (-1, -1), 1, colors.black),
]))
story.append(table)

doc.build(story)
```

### Important: subscript/superscript

Never use Unicode subscript/superscript characters (like `₂`, `³`) in reportlab. They cause font errors. Use XML markup instead:

```python
Paragraph("H<sub>2</sub>O and x<super>2</super>", style)
```

### Chinese / CJK text

Register a CJK font before using Chinese text:

```python
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

pdfmetrics.registerFont(TTFont("SimSun", "simsun.ttc"))
c.setFont("SimSun", 12)
c.drawString(72, height - 72, "中文文本")
```

## 3. Manipulating PDFs

### Merge multiple PDFs

```python
from pypdf import PdfWriter

writer = PdfWriter()
for pdf_file in ["part1.pdf", "part2.pdf", "part3.pdf"]:
    writer.append(pdf_file)
writer.write("merged.pdf")
writer.close()
```

### Split / extract pages

```python
from pypdf import PdfReader, PdfWriter

reader = PdfReader("large.pdf")
writer = PdfWriter()

# Extract pages 5-10 (0-indexed)
for page in reader.pages[4:10]:
    writer.add_page(page)
writer.write("pages_5_to_10.pdf")
writer.close()
```

### Rotate pages

```python
from pypdf import PdfReader, PdfWriter

reader = PdfReader("input.pdf")
writer = PdfWriter()
for page in reader.pages:
    page.rotate(90)  # 90, 180, or 270 degrees
    writer.add_page(page)
writer.write("rotated.pdf")
writer.close()
```

### Add watermark

```python
from pypdf import PdfReader, PdfWriter

reader = PdfReader("document.pdf")
watermark = PdfReader("watermark.pdf")
writer = PdfWriter()

for page in reader.pages:
    page.merge_page(watermark.pages[0])
    writer.add_page(page)
writer.write("watermarked.pdf")
writer.close()
```

### Password protection

```python
from pypdf import PdfWriter

writer = PdfWriter()
writer.append("document.pdf")
writer.encrypt(user_password="read_pass", owner_password="admin_pass")
writer.write("encrypted.pdf")
writer.close()
```

## 4. PDF form handling

See `forms.md` for detailed form field extraction and filling.

Quick overview:
- **Read form fields**: `pypdf.PdfReader` → `reader.get_fields()`
- **Fill fillable forms**: `pypdf.PdfWriter` → `writer.update_page_form_field_values()`
- **Non-fillable forms**: Add text annotations at specific coordinates

## 5. Quick reference

| Task | Tool / Library |
|------|---------------|
| Read text | `read` tool (built-in) |
| Extract tables | `pdfplumber` |
| OCR scanned PDFs | `pytesseract` + `pdf2image` |
| Create PDFs | `reportlab` |
| Merge / Split | `pypdf` |
| Rotate pages | `pypdf` |
| Watermark | `pypdf` |
| Encrypt / Decrypt | `pypdf` |
| Form fields | `pypdf` |

## 6. Dependencies

Core (included with Muse):
- `pypdf` — read, merge, split, rotate, encrypt, forms

Optional (install as needed):
- `pdfplumber` — table extraction: `pip install pdfplumber`
- `reportlab` — PDF creation: `pip install reportlab`
- `pytesseract` — OCR: `pip install pytesseract` (requires Tesseract binary)
- `pdf2image` — PDF to image: `pip install pdf2image` (requires Poppler)
