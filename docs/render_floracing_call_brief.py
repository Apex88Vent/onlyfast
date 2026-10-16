"""Render the editable FloRacing brief as a verified one-page PDF.

Requires reportlab and pypdf from the Codex bundled Python runtime.
Run from any working directory; outputs remain inside this project.
"""
from pathlib import Path
import re
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs' / 'FLORACING_CALL_BRIEF.md'
OUTPUT = ROOT / 'output' / 'pdf' / 'onlyfast-floracing-call-brief.pdf'
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

NAVY = colors.HexColor('#192330')
BLUE = colors.HexColor('#007da6')
GREY = colors.HexColor('#586272')
styles = {
    'title': ParagraphStyle('title', fontName='Helvetica-Bold', fontSize=23,
                            leading=26, textColor=NAVY, spaceAfter=5),
    'subtitle': ParagraphStyle('subtitle', fontName='Helvetica', fontSize=9,
                              leading=12, textColor=GREY, spaceAfter=10),
    'heading': ParagraphStyle('heading', fontName='Helvetica-Bold', fontSize=10.5,
                             leading=13, textColor=BLUE, spaceBefore=6, spaceAfter=4),
    'body': ParagraphStyle('body', fontName='Helvetica', fontSize=9.5,
                          leading=12.2, textColor=NAVY, spaceAfter=5,
                          alignment=TA_LEFT),
    'question': ParagraphStyle('question', fontName='Helvetica', fontSize=9.5,
                              leading=12.2, textColor=NAVY, spaceAfter=5,
                              leftIndent=12, firstLineIndent=-12),
    'source': ParagraphStyle('source', fontName='Helvetica', fontSize=7.2,
                            leading=9.4, textColor=GREY, spaceBefore=5),
}

def inline(text):
    text = escape(text)
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'`(.+?)`', r'\1', text)
    return text

story = []
for block in SOURCE.read_text(encoding='utf-8').strip().split('\n\n'):
    lines = block.splitlines()
    if lines[0].startswith('# '):
        story.append(Paragraph(inline(lines[0][2:]), styles['title']))
        if len(lines) > 1:
            story.append(Paragraph(inline(lines[1].strip('*')), styles['subtitle']))
    elif block.startswith('## '):
        story.append(Paragraph(inline(block[3:]), styles['heading']))
    elif block.startswith('<small>'):
        story.append(Paragraph(inline(block.removeprefix('<small>').removesuffix('</small>')),
                               styles['source']))
    elif re.match(r'^\d+\. ', block):
        for line in lines:
            story.append(Paragraph(inline(line), styles['question']))
    else:
        story.append(Paragraph(inline(' '.join(lines)), styles['body']))

def page_decoration(canvas, doc):
    canvas.setStrokeColor(BLUE)
    canvas.setLineWidth(2)
    canvas.line(42, 760, 570, 760)
    canvas.setFont('Helvetica', 7)
    canvas.setFillColor(GREY)
    canvas.drawString(42, 23, 'ONLYFAST  /  INTERNAL CALL PREPARATION')
    canvas.drawRightString(570, 23, '1')

doc = SimpleDocTemplate(str(OUTPUT), pagesize=letter, rightMargin=42, leftMargin=42,
                        topMargin=43, bottomMargin=34,
                        title='OnlyFast x FloRacing - Tulsa Shootout and Chili Bowl call brief',
                        author='OnlyFast')
doc.build(story, onFirstPage=page_decoration, onLaterPages=page_decoration)
reader = PdfReader(OUTPUT)
assert len(reader.pages) == 1, f'Expected one page; got {len(reader.pages)}'
extracted = re.sub(r'\s+', ' ', reader.pages[0].extract_text())
for expected in ['Introduction', 'Packages:', 'Rates and delivery:', 'Audience and targeting:',
                 'Timing and creative:', 'Performance:', 'metrics to verify internally', 'Code basis:']:
    assert expected in extracted, f'Missing text: {expected}'
print(f'Created {OUTPUT} | {len(reader.pages)} page | {len(extracted.split())} words')
