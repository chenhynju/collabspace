"""Generate empty, metadata-neutral OOXML templates; no external resources/macros."""
from pathlib import Path
from datetime import datetime
from docx import Document
from openpyxl import Workbook
from pptx import Presentation
root=Path(__file__).resolve().parents[1]/"packages/collab-store/templates"
root.mkdir(exist_ok=True)
def clean(props):
    props.author="";props.last_modified_by="";props.title="";props.subject="";props.comments=""
    props.created=datetime(2026,10,24);props.modified=datetime(2026,10,24)
d=Document();clean(d.core_properties);d.add_paragraph("");d.save(root/"blank.docx")
w=Workbook();w.active.title="Sheet1";w.properties.creator="";w.properties.lastModifiedBy="";w.properties.created=datetime(2026,10,24);w.properties.modified=datetime(2026,10,24);w.save(root/"blank.xlsx")
p=Presentation();clean(p.core_properties);p.slides.add_slide(p.slide_layouts[6]);p.save(root/"blank.pptx")
print("Generated blank Word, Excel (Sheet1), PowerPoint (one blank slide)")
