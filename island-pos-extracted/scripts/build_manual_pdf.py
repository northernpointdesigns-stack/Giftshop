import os
import sys
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_decorations(self, page_count):
        if self._pageNumber == 1:
            return
        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#475569"))
        self.drawString(54, 750, "ISLAND POS / GIFTSHOP — COMPLETE USER MANUAL & SETUP GUIDE")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
def build_pdf():
    styles = getSampleStyleSheet()

    PRIMARY = colors.HexColor("#0F1115")
    ACCENT = colors.HexColor("#0D9488")
    ACCENT_LIGHT = colors.HexColor("#CCFBF1")
    TEXT_MAIN = colors.HexColor("#1E293B")
    BG_BOX = colors.HexColor("#F8FAFC")
    BORDER_COLOR = colors.HexColor("#E2E8F0")

    title_style = ParagraphStyle('CTitle', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=26, leading=32, textColor=PRIMARY, spaceAfter=8)
    sub_style = ParagraphStyle('CSub', parent=styles['Normal'], fontName='Helvetica', fontSize=14, leading=18, textColor=ACCENT, spaceAfter=20)
    h1_style = ParagraphStyle('CH1', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=15, leading=19, textColor=PRIMARY, spaceBefore=14, spaceAfter=6, keepWithNext=True)
    h2_style = ParagraphStyle('CH2', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=11, leading=14, textColor=ACCENT, spaceBefore=8, spaceAfter=4, keepWithNext=True)
    body_style = ParagraphStyle('CBody', parent=styles['Normal'], fontName='Helvetica', fontSize=9, leading=13, textColor=TEXT_MAIN, spaceAfter=5)
    bullet_style = ParagraphStyle('CBullet', parent=body_style, leftIndent=12, spaceAfter=3)
    code_style = ParagraphStyle('CCode', parent=styles['Normal'], fontName='Courier', fontSize=8.5, leading=11, textColor=colors.HexColor("#0F172A"))

    story = []

    # COVER PAGE
    story.append(Spacer(1, 15))
    story.append(Paragraph("ISLAND POS / GIFTSHOP", title_style))
    story.append(Paragraph("Complete User Manual, System Architecture & Setup Guide", sub_style))
    story.append(HRFlowable(width="100%", thickness=3, color=ACCENT, spaceBefore=0, spaceAfter=15))

    meta = [
        [Paragraph("<b>Document Version:</b>", body_style), Paragraph("1.0.0 (Release Edition)", body_style)],
        [Paragraph("<b>Target Audience:</b>", body_style), Paragraph("Store Owners, Managers & Cashiers", body_style)],
        [Paragraph("<b>Supported Platforms:</b>", body_style), Paragraph("macOS (.dmg), Windows & Linux Desktop", body_style)],
        [Paragraph("<b>Licensing Engine:</b>", body_style), Paragraph("LemonSqueezy Online + Offline HMAC Engine", body_style)],
        [Paragraph("<b>Last Updated:</b>", body_style), Paragraph("August 2026", body_style)]
    ]
    t_meta = Table(meta, colWidths=[130, 374])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), BG_BOX),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 15))

    callout = [[Paragraph("<b>System Core Guarantee:</b> Island POS operates local-first. All inventory, cash snapshots, audit logs, and sales math run entirely on your device. Internet connectivity is only required once during LemonSqueezy license key activation.", body_style)]]
    t_callout = Table(callout, colWidths=[504])
    t_callout.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), ACCENT_LIGHT),
        ('BOX', (0,0), (-1,-1), 1.5, ACCENT),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_callout)
    story.append(PageBreak())

    # TABLE OF CONTENTS
    story.append(Paragraph("Table of Contents", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceAfter=10))

    toc = [
        ["1. Architecture & Offline Core", "Section 1"],
        ["2. Installation & First Launch", "Section 2"],
        ["3. Licensing & LemonSqueezy Integration", "Section 3"],
        ["4. User Roles & Security Audit Trail", "Section 4"],
        ["5. Daily Register & Till Operations", "Section 5"],
        ["6. Thermal Receipts & A4 Invoices", "Section 6"],
        ["7. Inventory, Stock Alerts & Supplier Ledgers", "Section 7"],
        ["8. EOD Balancing & Analytics", "Section 8"],
        ["9. Backup, Lossless Recovery & Troubleshooting", "Section 9"]
    ]
    t_toc = Table([[Paragraph(f"<b>{r[0]}</b>", body_style), Paragraph(r[1], body_style)] for r in toc], colWidths=[400, 104])
    t_toc.setStyle(TableStyle([
        ('LINEBELOW', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_toc)
    story.append(Spacer(1, 15))

    # SECTION 1
    story.append(Paragraph("1. System Architecture & Offline-First Core", h1_style))
    story.append(Paragraph("Island POS is built as a high-performance desktop application using Electron, React, and local IndexedDB/SQLite storage. Unlike cloud-based systems, Island POS processes all transactions, tax calculations, and receipts locally.", body_style))
    story.append(Paragraph("• <b>High SKU Scale:</b> Benchmarked to support 8,000+ SKU inventories with sub-3ms lookup speeds.", bullet_style))
    story.append(Paragraph("• <b>Local Data Storage:</b> All sales, register snapshots, and audit logs stay encrypted on the local machine.", bullet_style))
    story.append(Paragraph("• <b>Zero Cloud Dependency:</b> Complete shifts, issue thermal receipts, and view reports without internet.", bullet_style))

    # SECTION 2
    story.append(Paragraph("2. Installation & First Launch", h1_style))
    story.append(Paragraph("<b>macOS (.dmg) Installation:</b>", h2_style))
    story.append(Paragraph("1. Download <b>Giftshop.dmg</b> from your distribution portal.", bullet_style))
    story.append(Paragraph("2. Drag <b>Giftshop POS</b> into your <code>Applications</code> folder.", bullet_style))
    story.append(Paragraph("3. Launch the application. On first startup, the local database initializes automatically.", bullet_style))

    story.append(PageBreak())

    # SECTION 3
    story.append(Paragraph("3. Licensing & LemonSqueezy Integration", h1_style))
    story.append(Paragraph("Island POS includes a dual-mode licensing engine supporting LemonSqueezy checkout and offline HMAC fallback keys.", body_style))
    
    story.append(Paragraph("A. 14-Day Free Trial", h2_style))
    story.append(Paragraph("When first installed, the app provides a full 14-day offline trial. A trial indicator appears at the top of the app shell. After 14 days, the activation screen appears.", body_style))

    story.append(Paragraph("B. LemonSqueezy Online Activation (Customer Purchase)", h2_style))
    story.append(Paragraph("1. Buyer purchases a license on your LemonSqueezy storefront.", bullet_style))
    story.append(Paragraph("2. LemonSqueezy generates a license key and delivers it via checkout and email.", bullet_style))
    story.append(Paragraph("3. Customer opens Island POS and enters their <b>Purchase Email</b> and <b>License Key</b>.", bullet_style))
    story.append(Paragraph("4. The POS verifies the key via <code>https://api.lemonsqueezy.com/v1/licenses/activate</code> (no secret required).", bullet_style))
    story.append(Paragraph("5. Once validated as active, the key is cached locally. The POS is permanently unlocked and runs offline thereafter.", bullet_style))

    story.append(Paragraph("C. Offline HMAC Key Activation (Owner Fallback)", h2_style))
    story.append(Paragraph("For zero-internet machines, store owners can generate a deterministic key using:", body_style))
    story.append(Paragraph("<code>npx tsx scripts/generate-license.ts customer@email.com</code>", code_style))
    story.append(Paragraph("Entering this email and key activates the software offline via local HMAC verification.", body_style))

    # SECTION 4
    story.append(Paragraph("4. User Roles & Security Audit Trail", h1_style))
    r_data = [
        [Paragraph("<b>Role</b>", body_style), Paragraph("<b>Permissions</b>", body_style)],
        [Paragraph("<b>Admin</b>", body_style), Paragraph("Full access: Inventory, pricing overrides, tax settings, financial reports, EOD balancing, audit logs, and system reset.", body_style)],
        [Paragraph("<b>Cashier</b>", body_style), Paragraph("Restricted access: Barcode scanning, processing sales, accepting payments, and printing receipts. Cannot edit prices or view revenue.", body_style)]
    ]
    t_r = Table(r_data, colWidths=[100, 404])
    t_r.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), BG_BOX),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_r)
    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>SEC-004 Audit Trail:</b> All sensitive operations (voids, price overrides, till openings) are recorded in an append-only audit log with staff IDs and timestamps.", body_style))

    story.append(PageBreak())

    # SECTION 5
    story.append(Paragraph("5. Daily Register & Till Operations", h1_style))
    story.append(Paragraph("• <b>Opening Shift:</b> Select cashier profile and input starting cash float.", bullet_style))
    story.append(Paragraph("• <b>Cart & Scanning:</b> Scan barcodes directly or search by SKU/title. Custom item discounts can be applied.", bullet_style))
    story.append(Paragraph("• <b>Multi-Currency & Dual VAT:</b> Supports tax-inclusive / tax-exclusive modes and active currency conversion.", bullet_style))
    story.append(Paragraph("• <b>Closing Shift & EOD:</b> Input physical cash count; system automatically computes overage/shortage.", bullet_style))

    # SECTION 6
    story.append(Paragraph("6. Thermal Receipts & A4 Invoices", h1_style))
    p_data = [
        [Paragraph("<b>Format</b>", body_style), Paragraph("<b>Hardware</b>", body_style), Paragraph("<b>Features</b>", body_style)],
        [Paragraph("<b>Thermal Receipt</b>", body_style), Paragraph("80mm/58mm POS Printer", body_style), Paragraph("Itemized receipt, store logo, VAT summary, return barcode.", body_style)],
        [Paragraph("<b>A4 Business Invoice</b>", body_style), Paragraph("Laser / Inkjet Printer", body_style), Paragraph("Full invoice layout, customer details, terms, tax breakdown.", body_style)]
    ]
    t_p = Table(p_data, colWidths=[110, 130, 264])
    t_p.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), BG_BOX),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_p)

    # SECTION 7
    story.append(Paragraph("7. Inventory & Supplier Management", h1_style))
    story.append(Paragraph("• <b>Bulk CSV Import/Export:</b> Import up to 8,000+ SKUs via CSV.", bullet_style))
    story.append(Paragraph("• <b>Low Stock Alerts:</b> Automatic visual alerts when inventory drops below reorder thresholds.", bullet_style))
    story.append(Paragraph("• <b>Vendor Ledgers & Settlements:</b> Track supplier accounts, payables, and generate settlement sheets.", bullet_style))

    # SECTION 8 & 9
    story.append(Paragraph("8. Analytics & Financial Reporting", h1_style))
    story.append(Paragraph("• <b>EOD Reports:</b> Breakdown of cash, card, and digital payment totals.", bullet_style))
    story.append(Paragraph("• <b>Forecasting Heatmaps:</b> Visual density map showing peak store hours and busiest sales days.", bullet_style))

    story.append(Paragraph("9. Data Safety & Troubleshooting", h1_style))
    story.append(Paragraph("<b>Lossless Till-Close Backups:</b> Automatic database snapshots taken at every till close. Manual JSON backups can be exported from Admin Settings.", body_style))

    tr_data = [
        [Paragraph("<b>Symptom</b>", body_style), Paragraph("<b>Resolution</b>", body_style)],
        [Paragraph("License Key Invalid", body_style), Paragraph("Check purchase email spelling. Ensure active internet connection for first-time activation.", body_style)],
        [Paragraph("Barcode Scanner Not Reading", body_style), Paragraph("Ensure scanner is in USB HID mode and cursor is focused inside cart input.", body_style)],
        [Paragraph("Receipt Printer Disconnected", body_style), Paragraph("Verify USB printer connection and default printer selection in OS settings.", body_style)]
    ]
    t_tr = Table(tr_data, colWidths=[150, 354])
    t_tr.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), BG_BOX),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_tr)

    p1 = "/Users/alangouffe/Desktop/pos/Island_POS_User_Manual_and_Setup_Guide.pdf"
    p2 = "/Users/alangouffe/Desktop/pos/island-pos-extracted/Island_POS_User_Manual_and_Setup_Guide.pdf"
    
    doc = SimpleDocTemplate(p1, pagesize=letter, leftMargin=54, rightMargin=54, topMargin=64, bottomMargin=64)
    doc.build(story, canvasmaker=NumberedCanvas)
    print("Generated PDF manual at:", p1)
    
    import shutil
    shutil.copy(p1, p2)
    print("Copied PDF manual to:", p2)

if __name__ == '__main__':
    build_pdf()
