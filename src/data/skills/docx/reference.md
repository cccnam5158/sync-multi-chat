# python-docx API Reference

## Document

```python
from docx import Document

doc = Document()              # New document
doc = Document("file.docx")  # Open existing
doc.save("output.docx")      # Save
```

## Paragraphs

```python
# Add
para = doc.add_paragraph("Text")
para = doc.add_paragraph("Text", style="Heading 1")

# Access
for para in doc.paragraphs:
    print(para.text, para.style.name)

# Alignment
from docx.enum.text import WD_ALIGN_PARAGRAPH
para.alignment = WD_ALIGN_PARAGRAPH.CENTER
# Options: LEFT, CENTER, RIGHT, JUSTIFY
```

## Runs (text segments within a paragraph)

```python
run = para.add_run("text")

# Font properties
run.font.name = "Arial"
run.font.size = Pt(12)
run.font.bold = True
run.font.italic = True
run.font.underline = True
run.font.color.rgb = RGBColor(0xFF, 0x00, 0x00)
run.font.all_caps = True
run.font.strike = True

# East Asian (CJK) font — REQUIRED for Chinese/Japanese/Korean text
# Without this, CJK characters render as □ boxes
from docx.oxml.ns import qn
r_pr = run._element.get_or_add_rPr()
r_fonts = r_pr.find(qn('w:rFonts'))
if r_fonts is None:
    from docx.oxml import OxmlElement
    r_fonts = OxmlElement('w:rFonts')
    r_pr.insert(0, r_fonts)
r_fonts.set(qn('w:eastAsia'), 'Microsoft YaHei')  # 微软雅黑

# Line break within paragraph
run.add_break()
```

## Headings

```python
doc.add_heading("Title", level=0)      # Title style
doc.add_heading("Heading 1", level=1)  # Heading 1
doc.add_heading("Heading 2", level=2)  # Heading 2
```

## Tables

```python
# Create
table = doc.add_table(rows=2, cols=3, style="Table Grid")

# Access cells
cell = table.rows[0].cells[0]
cell.text = "Value"

# Add row
row = table.add_row()

# Merge cells
cell_a = table.cell(0, 0)
cell_b = table.cell(0, 2)
cell_a.merge(cell_b)

# Width
from docx.shared import Cm
cell.width = Cm(5)
```

## Images

```python
from docx.shared import Inches, Cm

doc.add_picture("image.png", width=Inches(4))
doc.add_picture("image.png", width=Cm(10), height=Cm(7))
```

## Page breaks

```python
from docx.enum.text import WD_BREAK

para = doc.add_paragraph()
run = para.add_run()
run.add_break(WD_BREAK.PAGE)
```

## Sections

```python
from docx.shared import Cm
from docx.enum.section import WD_ORIENT

section = doc.sections[0]

# Page size
section.page_width = Cm(21)
section.page_height = Cm(29.7)

# Margins
section.top_margin = Cm(2.54)
section.bottom_margin = Cm(2.54)
section.left_margin = Cm(3.17)
section.right_margin = Cm(3.17)

# Orientation
section.orientation = WD_ORIENT.LANDSCAPE

# Add new section
from docx.enum.section import WD_SECTION_START
doc.add_section(WD_SECTION_START.NEW_PAGE)
```

## Headers / Footers

```python
section = doc.sections[0]

# Header
header = section.header
header.is_linked_to_previous = False
header.paragraphs[0].text = "Header text"

# Footer
footer = section.footer
footer.is_linked_to_previous = False
footer.paragraphs[0].text = "Footer text"
```

## Core properties

```python
props = doc.core_properties
props.author = "Author Name"
props.title = "Document Title"
props.subject = "Subject"
props.keywords = "keyword1, keyword2"
props.comments = "Description"
```

## Shared units

```python
from docx.shared import Inches, Cm, Pt, Emu, RGBColor

# 1 inch = 914400 EMU = 72 points
# 1 cm = 360000 EMU
# 1 point = 12700 EMU
```
