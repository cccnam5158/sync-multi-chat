---
name: docx
description: Word document processing — reading, creating with python-docx, editing via XML manipulation, styles, tables, images, headers/footers, tracked changes.
---

# Word Document (DOCX) Processing

When the user needs to read, create, or edit Word documents, follow this guide.

## 1. Reading DOCX files

### Quick text extraction

Use the `read` tool directly — it natively extracts text from DOCX files:

```
read(file_path="report.docx")
```

Returns paragraphs (with heading markers) and tables in Markdown-like format.

### Detailed access

For more control (styles, formatting, images), use `python-docx` via a Python script:

```python
from docx import Document

doc = Document("report.docx")

# Paragraphs with style info
for para in doc.paragraphs:
    print(f"[{para.style.name}] {para.text}")

# Tables
for table in doc.tables:
    for row in table.rows:
        print([cell.text for cell in row.cells])

# Document properties
props = doc.core_properties
print(f"Author: {props.author}")
print(f"Created: {props.created}")
```

## 2. Creating DOCX files

### Basic document

```python
from docx import Document
from docx.shared import Inches, Pt, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH

doc = Document()

# Title
doc.add_heading("Document Title", level=0)

# Paragraph with formatting
para = doc.add_paragraph()
run = para.add_run("Bold text")
run.bold = True
para.add_run(" and ")
run2 = para.add_run("italic text")
run2.italic = True

# Normal paragraph
doc.add_paragraph("This is a normal paragraph.")

# Bullet list
doc.add_paragraph("First item", style="List Bullet")
doc.add_paragraph("Second item", style="List Bullet")

# Numbered list
doc.add_paragraph("Step one", style="List Number")
doc.add_paragraph("Step two", style="List Number")

doc.save("output.docx")
```

### Tables

```python
from docx import Document
from docx.shared import Cm
from docx.oxml.ns import qn

doc = Document()

# Create table
table = doc.add_table(rows=3, cols=3, style="Table Grid")

# Set header row
headers = ["Name", "Department", "Salary"]
for i, header in enumerate(headers):
    cell = table.rows[0].cells[i]
    cell.text = header
    # Bold header
    for para in cell.paragraphs:
        for run in para.runs:
            run.bold = True

# Fill data
data = [
    ["Alice", "Engineering", "$120,000"],
    ["Bob", "Marketing", "$95,000"],
]
for row_idx, row_data in enumerate(data, 1):
    for col_idx, value in enumerate(row_data):
        table.rows[row_idx].cells[col_idx].text = value

# Set column widths
for row in table.rows:
    row.cells[0].width = Cm(4)
    row.cells[1].width = Cm(4)
    row.cells[2].width = Cm(3)

doc.save("table.docx")
```

### Images

```python
from docx import Document
from docx.shared import Inches

doc = Document()
doc.add_heading("Report with Image", level=1)
doc.add_picture("chart.png", width=Inches(5))
doc.add_paragraph("Figure 1: Quarterly results")
doc.save("report.docx")
```

### Headers and footers

```python
from docx import Document

doc = Document()

# Header
section = doc.sections[0]
header = section.header
header.paragraphs[0].text = "Company Name — Confidential"

# Footer with page number
footer = section.footer
footer.paragraphs[0].text = "Page "
# Page number requires XML manipulation for auto-numbering

doc.save("with_header.docx")
```

### Page setup

```python
from docx import Document
from docx.shared import Cm, Inches
from docx.enum.section import WD_ORIENT

doc = Document()
section = doc.sections[0]

# Page size (A4)
section.page_width = Cm(21)
section.page_height = Cm(29.7)

# Margins
section.top_margin = Cm(2.54)
section.bottom_margin = Cm(2.54)
section.left_margin = Cm(3.17)
section.right_margin = Cm(3.17)

# Landscape orientation
section.orientation = WD_ORIENT.LANDSCAPE
# Swap width/height for landscape
section.page_width, section.page_height = section.page_height, section.page_width
```

## 3. Editing existing DOCX files

### Simple modifications with python-docx

```python
from docx import Document

doc = Document("existing.docx")

# Modify paragraph text
for para in doc.paragraphs:
    if "old text" in para.text:
        for run in para.runs:
            run.text = run.text.replace("old text", "new text")

doc.save("modified.docx")
```

### XML-level editing (advanced)

DOCX files are ZIP archives containing XML. For complex edits:

1. **Unpack**: Extract the ZIP to access XML files
2. **Edit**: Modify the XML directly
3. **Repack**: Zip the files back into a .docx

```python
import zipfile
import os
import shutil

def unpack_docx(docx_path, output_dir):
    """Extract DOCX to a directory."""
    with zipfile.ZipFile(docx_path, "r") as z:
        z.extractall(output_dir)

def pack_docx(input_dir, docx_path):
    """Repackage directory into DOCX."""
    with zipfile.ZipFile(docx_path, "w", zipfile.ZIP_DEFLATED) as z:
        for root, dirs, files in os.walk(input_dir):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, input_dir)
                z.write(file_path, arcname)

# Usage
unpack_docx("document.docx", "unpacked/")
# Edit unpacked/word/document.xml
pack_docx("unpacked/", "modified.docx")
```

### Key XML files in a DOCX

| Path | Content |
|------|---------|
| `word/document.xml` | Main document body |
| `word/styles.xml` | Style definitions |
| `word/header1.xml` | Header content |
| `word/footer1.xml` | Footer content |
| `word/numbering.xml` | List numbering definitions |
| `word/_rels/document.xml.rels` | Relationships (images, etc.) |
| `[Content_Types].xml` | MIME type declarations |

### XML namespace

DOCX XML uses the WordprocessingML namespace:

```xml
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>              <!-- paragraph -->
      <w:pPr>          <!-- paragraph properties -->
        <w:pStyle w:val="Heading1"/>
      </w:pPr>
      <w:r>            <!-- run -->
        <w:rPr>        <!-- run properties -->
          <w:b/>       <!-- bold -->
        </w:rPr>
        <w:t>Text</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>
```

## 4. Styles reference

### Built-in styles

| Style name | Use case |
|------------|----------|
| `Normal` | Body text |
| `Heading 1` ~ `Heading 9` | Section headings |
| `Title` | Document title |
| `Subtitle` | Document subtitle |
| `List Bullet` | Bulleted list |
| `List Number` | Numbered list |
| `Quote` | Block quote |
| `Table Grid` | Table with borders |

### Custom font and size

```python
from docx.shared import Pt, RGBColor

run = para.add_run("Custom text")
run.font.name = "Arial"
run.font.size = Pt(14)
run.font.color.rgb = RGBColor(0x42, 0x24, 0xE9)
run.font.bold = True
run.font.italic = True
run.font.underline = True
```

### CJK (Chinese/Japanese/Korean) font support

**IMPORTANT**: `run.font.name` only sets the Western font (`w:ascii`/`w:hAnsi`).
CJK characters require the East Asian font (`w:eastAsia`) to be set via XML,
otherwise they render as □ (empty boxes) in Word.

**Always use this helper when the document contains CJK text:**

```python
from docx.oxml.ns import qn

def set_run_font(run, western_font="Arial", east_asia_font="Microsoft YaHei", size_pt=None):
    """Set both Western and East Asian fonts on a run."""
    run.font.name = western_font
    # Set East Asian font via XML (required for CJK characters)
    r_element = run._element
    rPr = r_element.get_or_add_rPr()
    rFonts = rPr.find(qn('w:rFonts'))
    if rFonts is None:
        from docx.oxml import OxmlElement
        rFonts = OxmlElement('w:rFonts')
        rPr.insert(0, rFonts)
    rFonts.set(qn('w:eastAsia'), east_asia_font)
    if size_pt:
        from docx.shared import Pt
        run.font.size = Pt(size_pt)

# Usage
run = para.add_run("中文文本 English text")
set_run_font(run, "Arial", "Microsoft YaHei", size_pt=12)
```

**Common East Asian fonts:**

| Font | Name in code | Notes |
|------|-------------|-------|
| 微软雅黑 | `Microsoft YaHei` | Modern sans-serif, recommended |
| 宋体 | `SimSun` | Traditional serif, formal documents |
| 黑体 | `SimHei` | Sans-serif, headings |
| 楷体 | `KaiTi` | Handwriting style |
| 仿宋 | `FangSong` | Formal/government documents |
| MS Mincho | `MS Mincho` | Japanese serif |
| MS Gothic | `MS Gothic` | Japanese sans-serif |
| 맑은 고딕 | `Malgun Gothic` | Korean |

**Setting CJK font on default document style** (applies to all new text):

```python
from docx.oxml.ns import qn

doc = Document()
style = doc.styles['Normal']
style.font.name = 'Arial'
style.element.rPr.rFonts.set(qn('w:eastAsia'), 'Microsoft YaHei')
```

## 5. Dependencies

Core (included with Muse):
- `python-docx` — read, create, basic editing

No additional optional dependencies required for most tasks.
