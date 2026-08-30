#!/usr/bin/env python3
"""Giftshop POS — Download & Activation links PDF.

A small (few-KB) PDF that contains the live GitHub release download links
for the customer trial build (v1.0.0-customer). This is the file that gets
attached to the Payhip products (free trial AND paid) — the big installers
stay on GitHub Releases; this PDF just points buyers at them.

Run:  python3 scripts/build_download_links_pdf.py
Out:  docs/Giftshop_POS_Download_and_Activation.pdf
"""
from pathlib import Path
import sys

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
    )
    from reportlab.pdfgen import canvas
except ImportError:
    print("pip install reportlab", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "Giftshop_POS_Download_and_Activation.pdf"

# Brand colors (match customer guide)
PRIMARY = colors.HexColor("#0F1115")
ACCENT = colors.HexColor("#0D9488")
ACCENT_L = colors.HexColor("#F0FDF4")
WARN_BG = colors.HexColor("#FFF7ED")
WARN_BD = colors.HexColor("#F59E0B")
TEXT = colors.HexColor("#1E293B")
MUTED = colors.HexColor("#64748B")
BG = colors.HexColor("#F8FAFC")
BORDER = colors.HexColor("#E2E8F0")

# Live assets on the Giftshop v1.0.0-customer release.
BASE_GH = "https://github.com/northernpointdesigns-stack/Giftshop/releases/download/v1.0.0-customer"
DMG = f"{BASE_GH}/The.Gift.Shop.POS-1.0.0-arm64.dmg"
ZIP = f"{BASE_GH}/The.Gift.Shop.POS-1.0.0-arm64-mac.zip"
EXE = f"{BASE_GH}/The.Gift.Shop.POS.Setup.1.0.0.exe"
PDF_LINK = f"{BASE_GH}/Giftshop_POS_Customer_Setup_and_User_Guide.pdf"

SCHED_TXT = (
    "macOS Apple Silicon (M1/M2/M3/M4):\n"
    + DMG
    + "\n\nmacOS zip (alternative):\n"
    + ZIP
    + "\n\nWindows (64-bit, .exe installer):\n"
    + EXE
    + "\n\nFull Setup & User Guide (.pdf):\n"
    + PDF_LINK
)
class NumberedCanvas(canvas.Canvas):
    """Repeat header/footer on each page."""
    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        self._saved = []

    def showPage(self):
        self._saved.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        n = len(self._saved)
        for st in self._saved:
            self.__dict__.update(st)
            if self._pageNumber != 1:
                self.saveState()
                self.setFont("Helvetica-Bold", 8)
                self.setFillColor(MUTED)
                self.drawString(54, 750, "GIFTSHOP POS — Download & Activation")
                self.setStrokeColor(ACCENT)
                self.line(54, 742, 558, 742)
                self.setFont("Helvetica", 8)
                self.drawString(54, 36, "Trial build · License activation via Payhip key")
                self.drawRightString(558, 36, f"Page {self._pageNumber} of {n}")
                self.line(54, 46, 558, 46)
                self.restoreState()
            super().showPage()
        super().save()


def S():
    b = getSampleStyleSheet()
    return dict(
        t=ParagraphStyle("t", parent=b["Normal"], fontName="Helvetica-Bold", fontSize=20, leading=26, textColor=PRIMARY, spaceAfter=6),
        s=ParagraphStyle("s", parent=b["Normal"], fontName="Helvetica", fontSize=10, leading=14, textColor=ACCENT, spaceAfter=12),
        h1=ParagraphStyle("h1", parent=b["Normal"], fontName="Helvetica-Bold", fontSize=12.5, leading=16, textColor=PRIMARY, spaceBefore=10, spaceAfter=5),
        h2=ParagraphStyle("h2", parent=b["Normal"], fontName="Helvetica-Bold", fontSize=10, leading=13, textColor=ACCENT, spaceBefore=7, spaceAfter=3),
        b=ParagraphStyle("b", parent=b["Normal"], fontName="Helvetica", fontSize=9, leading=12, textColor=TEXT, spaceAfter=4),
        bu=ParagraphStyle("bu", parent=b["Normal"], fontName="Helvetica", fontSize=9, leading=12, textColor=TEXT, leftIndent=12, spaceAfter=2),
        c=ParagraphStyle("c", parent=b["Normal"], fontName="Courier", fontSize=7.6, leading=10, textColor=MUTED),
        sm=ParagraphStyle("sm", parent=b["Normal"], fontName="Helvetica", fontSize=8, leading=10, textColor=MUTED),
    )


def box(txt, st, bg=ACCENT_L, bd=ACCENT):
    t = Table([[Paragraph(txt, st)]], colWidths=[504])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("BOX", (0, 0), (-1, -1), 1.2, bd),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t


def bu(items, st):
    return [Paragraph("• " + i, st) for i in items]
def build():
    st = S()
    story = []
    story += [
        Spacer(1, 18),
        Paragraph("GIFTSHOP POS", st["t"]),
        Paragraph("Download the app & activate your license", st["s"]),
        HRFlowable(width="100%", thickness=3, color=ACCENT, spaceAfter=10),
    ]
    meta = [
        [Paragraph("<b>What you need</b>", st["b"]), Paragraph("The installer below + your license key (paid buyers)", st["b"])],
        [Paragraph("<b>Trial</b>", st["b"]), Paragraph("14-day free trial inside the app — no key needed", st["b"])],
        [Paragraph("<b>Full license</b>", st["b"]), Paragraph("Payhip emails a unique key after purchase — enter it in the app", st["b"])],
    ]
    mt = Table(meta, colWidths=[100, 404])
    mt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BG),
        ("BOX", (0, 0), (-1, -1), 1, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story += [mt, Spacer(1, 12)]

    story += [Paragraph("Download the installer", st["h1"]), HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=6)]
    links = [
        ["macOS", "Apple Silicon (M1–M4)", DMG],
        ["macOS", "Zip (alternative)", ZIP],
        ["Windows", "64-bit installer (.exe)", EXE],
    ]
    rows = [
        [Paragraph("<b>System</b>", st["b"]), Paragraph("<b>Notes</b>", st["b"]), Paragraph("<b>Download</b>", st["b"])],
    ]
    def linkcell(url):
        return Paragraph(
            f'<link href="{url}"><font face="Courier" size="6.5" color="#0D9488"><u>{url}</u></font></link>',
            st["sm"],
        )

    for sys_, note, link in links:
        rows.append([
            Paragraph(sys_, st["b"]),
            Paragraph(note, st["b"]),
            linkcell(link),
        ])
    lt = Table(rows, colWidths=[78, 118, 308])
    lt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BG),
        ("BOX", (0, 0), (-1, -1), 0.7, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story += [lt, Spacer(1, 8)]
    story += [Paragraph("Full Setup &amp; User Guide:", st["b"]), linkcell(PDF_LINK), Spacer(1, 6)]

    story += [Paragraph("Install steps (quick recap)", st["h1"]), HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=6)]
    story += bu([
        "<b>Windows:</b> run the .exe. If SmartScreen appears, click <b>More info → Run anyway</b>.",
        "<b>macOS:</b> open the .dmg → drag “The Gift Shop POS” to Applications → open. If macOS warns it's from an unidentified developer: right-click → <b>Open</b>, or run <br/><font face='Courier' size='7.6'>xattr -cr \"/Applications/The Gift Shop POS.app\"</font> in Terminal.",
        "<b>First launch:</b> the app starts a <b>14-day free trial</b> — full features, no key needed.",
        "<b>Unlock:</b> after the trial (or any time), click Activate, enter the <b>email</b> from your checkout and your <b>license key</b> from Payhip → permanently unlocked.",
        "<b>No separate paid download needed.</b> The same installer works for trial and paid — the key is what unlocks it.",
    ], st["bu"])

    story += [Spacer(1, 10), box(
        "<b>SmartScreen (Windows):</b> “Windows protected your PC” on an unsigned installer is normal. "
        "If it appears: <b>More info → Run anyway</b>. Always download from this official link — never from third-party mirrors.",
        st["sm"], WARN_BG, WARN_BD,
    )]

    story += [Spacer(1, 12), Paragraph("Full URLs (clickable)", st["h1"]), HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=6)]
    url_rows = [
        ("macOS Apple Silicon (M1/M2/M3/M4):", DMG),
        ("macOS zip (alternative):", ZIP),
        ("Windows (64-bit, .exe installer):", EXE),
        ("Full Setup & User Guide (.pdf):", PDF_LINK),
    ]
    for label, url in url_rows:
        story += [Paragraph(label, st["b"]), linkcell(url), Spacer(1, 4)]
    story += [Spacer(1, 4), Paragraph("Questions? Reply to your Payhip receipt email — we're happy to help.", st["sm"])]

    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=letter,
        leftMargin=54, rightMargin=54, topMargin=56, bottomMargin=52,
        title="Giftshop POS — Download & Activation",
        author="Giftshop POS",
    )
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    build()