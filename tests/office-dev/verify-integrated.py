"""Validate actual application downloads, not HTTP status or engine responses."""
import argparse
import json
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

parser = argparse.ArgumentParser()
parser.add_argument('--results', default='.test-runs/office-integrated/results')
parser.add_argument('--suffix', default='')
args = parser.parse_args()
root = Path(args.results)
results = {}
for name, ext, prefix in [('word', 'docx', 'word/'), ('sheet', 'xlsx', 'xl/'), ('slides', 'pptx', 'ppt/')]:
    markers = json.loads((root / (name + '-markers.json')).read_text())
    with ZipFile(root / (name + args.suffix + '.' + ext)) as archive:
        names = archive.namelist()
        text = ''.join(''.join(ET.fromstring(archive.read(n)).itertext()) for n in names
                       if n.startswith(prefix) and n.endswith('.xml'))
        assert all(marker in text for marker in markers), name + ': missing participant edit'
        if name == 'word':
            document = ET.fromstring(archive.read('word/document.xml'))
            assert document.findall('.//{*}tbl'), 'Word table lost'
            assert any(n.startswith('word/media/') for n in names), 'Word image lost'
        elif name == 'sheet':
            sheets = [n for n in names if n.startswith('xl/worksheets/sheet') and n.endswith('.xml')]
            assert len(sheets) == 2, 'Worksheet lost'
            document = ET.fromstring(archive.read('xl/worksheets/sheet1.xml'))
            cell = next(c for c in document.findall('.//{*}c') if c.attrib.get('r') == 'B2')
            assert cell.find('{*}f').text == 'SUM(A2:A3)', 'Formula changed'
            assert float(cell.find('{*}v').text) == 5, 'Formula result incorrect'
        else:
            assert len([n for n in names if n.startswith('ppt/slides/slide') and n.endswith('.xml')]) == 2
            assert any(n.startswith('ppt/media/') for n in names), 'Slide image lost'
        results[name] = {'participantEdits': 2, 'originalStructurePreserved': True}
print(json.dumps(results))
