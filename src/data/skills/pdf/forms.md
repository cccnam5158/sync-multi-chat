# PDF Form Handling

## Detecting form fields

```python
from pypdf import PdfReader

reader = PdfReader("form.pdf")
fields = reader.get_fields()

if fields:
    print("Fillable form detected")
    for name, field in fields.items():
        field_type = field.get("/FT", "unknown")
        value = field.get("/V", "")
        print(f"  {name} ({field_type}): {value}")
else:
    print("No fillable fields found")
```

### Field types

| Type | Description |
|------|-------------|
| `/Tx` | Text field |
| `/Btn` | Button (checkbox, radio) |
| `/Ch` | Choice (dropdown, list) |
| `/Sig` | Signature |

## Filling fillable forms

```python
from pypdf import PdfReader, PdfWriter

reader = PdfReader("form.pdf")
writer = PdfWriter()
writer.append(reader)

# Fill fields on page 0
writer.update_page_form_field_values(
    writer.pages[0],
    {
        "name_field": "John Smith",
        "date_field": "2025-01-15",
        "email_field": "john@example.com",
    },
)

writer.write("filled_form.pdf")
writer.close()
```

## Filling non-fillable forms (annotation-based)

When a PDF looks like a form but has no fillable fields, add text at specific coordinates:

```python
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from pypdf import PdfReader, PdfWriter
import io

# 1. Create overlay with text at form positions
packet = io.BytesIO()
c = canvas.Canvas(packet, pagesize=letter)
c.setFont("Helvetica", 10)

# Position text at form field locations (x, y from bottom-left)
c.drawString(150, 680, "John Smith")       # Name field
c.drawString(150, 650, "2025-01-15")       # Date field
c.drawString(150, 620, "john@example.com") # Email field

c.save()
packet.seek(0)

# 2. Merge overlay onto original form
overlay = PdfReader(packet)
original = PdfReader("form.pdf")
writer = PdfWriter()

for i, page in enumerate(original.pages):
    if i < len(overlay.pages):
        page.merge_page(overlay.pages[i])
    writer.add_page(page)

writer.write("filled_form.pdf")
writer.close()
```

### Finding field coordinates

To determine where to place text on a non-fillable form:

1. Use `pdfplumber` to extract text positions and find reference points
2. Or convert to image and measure coordinates:

```python
from pdf2image import convert_from_path

# Convert first page to image for visual inspection
images = convert_from_path("form.pdf", first_page=1, last_page=1, dpi=72)
images[0].save("form_page1.png")
# Open the image and note pixel coordinates
# In a 72 DPI image, pixels = points (PDF coordinate units)
```

## Extracting form data

```python
from pypdf import PdfReader

reader = PdfReader("filled_form.pdf")
fields = reader.get_fields()

form_data = {}
for name, field in fields.items():
    value = field.get("/V", "")
    # Decode if needed
    if hasattr(value, "get_object"):
        value = str(value.get_object())
    form_data[name] = value

print(form_data)
```
