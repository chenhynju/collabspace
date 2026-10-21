from pathlib import Path
from docx import Document
from docx.shared import Inches
from openpyxl import Workbook
from pptx import Presentation
from pptx.util import Inches as PptInches

root=Path('.test-runs/office/fixtures');root.mkdir(parents=True,exist_ok=True)
doc=Document();doc.add_heading('CollabSpace Word baseline',0);doc.add_paragraph('Original paragraph remains after concurrent editing.')
table=doc.add_table(rows=2,cols=2);table.cell(0,0).text='Item';table.cell(0,1).text='Value';table.cell(1,0).text='Baseline';table.cell(1,1).text='Preserved'
doc.add_picture('tests/browser/fixtures/article.png',width=Inches(2));doc.save(root/'baseline.docx')
book=Workbook();sheet=book.active;sheet.title='Baseline';sheet['A1']='CollabSpace Excel baseline';sheet['A2']=2;sheet['A3']=3;sheet['B2']='=SUM(A2:A3)';book.create_sheet('Second sheet');book.save(root/'baseline.xlsx')
slides=Presentation();slide=slides.slides.add_slide(slides.slide_layouts[6]);slide.shapes.add_textbox(PptInches(1),PptInches(1),PptInches(8),PptInches(1)).text='CollabSpace PowerPoint baseline';slide.shapes.add_picture('tests/browser/fixtures/article.png',PptInches(1),PptInches(3),width=PptInches(3));slides.slides.add_slide(slides.slide_layouts[6]);slides.save(root/'baseline.pptx')
print('Created three synthetic OOXML fixtures')
