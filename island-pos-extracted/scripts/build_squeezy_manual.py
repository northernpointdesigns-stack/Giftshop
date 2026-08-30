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
        self.drawString(54, 750, "GIFTSHOP POS — PREMIUM MANUAL, SPECIFICATIONS & SETUP GUIDE")
        self.setStrokeColor(colors.HexColor("#0D9488"))
        self.setLineWidth(0.75)
        self.line(54, 742, 558, 742)
        
        self.setFont("Helvetica", 8)
        self.drawString(54, 36, "Licensed Product Document — Giftshop POS Solutions")
        self.drawRightString(558, 36, f"Page {self._pageNumber} of {page_count}")
        self.line(54, 46, 558, 46)
        self.restoreState()

def build_pdf():
    PRIMARY = colors.HexColor("#0F1115")      # Dark Navy
    ACCENT = colors.HexColor("#0D9488")       # Emerald/Teal
    ACCENT_LIGHT = colors.HexColor("#F0FDF4") # Light Green BG
    TEXT_MAIN = colors.HexColor("#1E293B")    # Slate 800
    BG_BOX = colors.HexColor("#F8FAFC")       # Slate 50
    BORDER_COLOR = colors.HexColor("#E2E8F0") # Slate 200

    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle('CTitle', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=24, leading=30, textColor=PRIMARY, spaceAfter=6)
    sub_style = ParagraphStyle('CSub', parent=styles['Normal'], fontName='Helvetica', fontSize=12, leading=16, textColor=ACCENT, spaceAfter=20)
    h1_style = ParagraphStyle('CH1', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=14, leading=18, textColor=PRIMARY, spaceBefore=12, spaceAfter=6, keepWithNext=True)
    h2_style = ParagraphStyle('CH2', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10.5, leading=13.5, textColor=ACCENT, spaceBefore=8, spaceAfter=4, keepWithNext=True)
    body_style = ParagraphStyle('CBody', parent=styles['Normal'], fontName='Helvetica', fontSize=9, leading=13, textColor=TEXT_MAIN, spaceAfter=5)
    bullet_style = ParagraphStyle('CBullet', parent=body_style, leftIndent=12, spaceAfter=3)
    code_style = ParagraphStyle('CCode', parent=styles['Normal'], fontName='Courier', fontSize=8.5, leading=11, textColor=colors.HexColor("#0F172A"))

    story = []

    # --- COVER PAGE ---
    story.append(Spacer(1, 10))
    story.append(Paragraph("GIFTSHOP POS & INVENTORY", title_style))
    story.append(Paragraph("Official Setup Guide, Option Reference & Troubleshooting Manual", sub_style))
    story.append(HRFlowable(width="100%", thickness=4, color=ACCENT, spaceBefore=0, spaceAfter=15))

    meta = [
        [Paragraph("<b>Document Type:</b>", body_style), Paragraph("Official Squeezy Customer Guide Bundle", body_style)],
        [Paragraph("<b>Target Audience:</b>", body_style), Paragraph("Retail Store Owners, Managers, Consignors & Cashiers", body_style)],
        [Paragraph("<b>Applicable Version:</b>", body_style), Paragraph("v1.0.0+ Desktop Edition (.dmg / .exe)", body_style)],
        [Paragraph("<b>Licensing Engine:</b>", body_style), Paragraph("LemonSqueezy Automated Keys (Online + Local Cache)", body_style)],
        [Paragraph("<b>Day-One Support:</b>", body_style), Paragraph("support@your-store.example.com", body_style)]
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

    welcome_box = [[Paragraph("<b>Congratulations on your purchase!</b><br/>Your license key delivered by LemonSqueezy has been generated specifically for your purchase. Input your purchase email and key into the Giftshop POS activation screen to unlock lifetime usage. This manual describes every option, hardware requirement, and advanced configuration option inside your software.", body_style)]]
    t_welcome = Table(welcome_box, colWidths=[504])
    t_welcome.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), ACCENT_LIGHT),
        ('BOX', (0,0), (-1,-1), 1.5, ACCENT),
        ('PADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(t_welcome)
    story.append(PageBreak())

    # --- TABLE OF CONTENTS ---
    story.append(Paragraph("Table of Contents & Feature Index", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceAfter=10))

    toc = [
        ["1. App Description & Key Capabilities", "Page 2"],
        ["2. Quick-Start Setup & First-Time Launch", "Page 2"],
        ["3. LemonSqueezy Activation & Trial Options", "Page 3"],
        ["4. Cashier Security & Append-Only Audit Logging", "Page 3"],
        ["5. Checkout, Cart & Multi-Currency Sales", "Page 4"],
        ["6. VAT Tax Modes (Inclusive vs Exclusive)", "Page 4"],
        ["7. Retail vs. Consignment Inventory & Vendor Ledgers", "Page 5"],
        ["8. Hardware Integrations (Printers & Barcode Rules)", "Page 5"],
        ["9. Reports, EOD Balancing & Analytics", "Page 6"],
        ["10. Backups, Recovery & Troubleshooting", "Page 6"]
    ]
    t_toc = Table([[Paragraph(f"<b>{r[0]}</b>", body_style), Paragraph(r[1], body_style)] for r in toc], colWidths=[400, 104])
    t_toc.setStyle(TableStyle([
        ('LINEBELOW', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 5.5),
    ]))
    story.append(t_toc)
    story.append(PageBreak())

    # --- CONTENT ---
    story.append(Paragraph("1. App Description & Key Capabilities", h1_style))
    story.append(Paragraph("Giftshop POS is a modern, premium point-of-sale and inventory system designed specifically for gift shops, boutiques, souvenir outlets, and shared retail spaces. Unlike cloud-reliant solutions, it operates on a secure local-first database to guarantee zero down-time.", body_style))
    story.append(Paragraph("• <b>Local-First Execution:</b> All pricing algorithms, barcode scanning, transaction histories, and report generations execute locally on your machine with 0ms latency.", bullet_style))
    story.append(Paragraph("• <b>Consignment Handling:</b> Built-in mechanisms to calculate store commissions vs. vendor payables automatically upon checkout.", bullet_style))
    story.append(Paragraph("• <b>Dual Currency:</b> Dynamically handle base currencies alongside secondary checkout currencies with real-time conversion rates on invoices.", bullet_style))

    story.append(Paragraph("2. Quick-Start Setup & First-Time Launch", h1_style))
    story.append(Paragraph("<b>macOS Installation Steps:</b>", h2_style))
    story.append(Paragraph("1. Open the downloaded <b>Giftshop.dmg</b> file from your purchase page.", bullet_style))
    story.append(Paragraph("2. Drag the <b>Giftshop</b> application icon to your <code>Applications</code> shortcut.", bullet_style))
    story.append(Paragraph("3. Launch the application from your Dock or Launchpad.", bullet_style))
    story.append(Paragraph("4. Select the 'Administrator' user profile (default PIN is <code>admin123</code>) to begin your initial inventory configuration.", bullet_style))
    story.append(Paragraph("<b>Windows Installation Steps:</b>", h2_style))
    story.append(Paragraph("1. Launch the <code>Giftshop.Setup.exe</code> file and click Install.", bullet_style))
    story.append(Paragraph("2. The system automatically initializes local database storage for your shop.", bullet_style))

    story.append(PageBreak())

    # --- LICENSING ---
    story.append(Paragraph("3. LemonSqueezy Activation & Trial Options", h1_style))
    story.append(Paragraph("Your copy of Giftshop POS includes a fully-automated 14-day free trial. If you are activating the software following your purchase, follow these steps:", body_style))
    story.append(Paragraph("1. Copy the <b>License Key</b> provided in your LemonSqueezy purchase confirmation email.", bullet_style))
    story.append(Paragraph("2. Launch Giftshop POS. If the trial has expired, the License Gate will appear immediately.", bullet_style))
    story.append(Paragraph("3. Enter your <b>Purchase Email</b> exactly as inputted during checkout, and paste your <b>License Key</b>.", bullet_style))
    story.append(Paragraph("4. Click <b>Activate License</b>. The application contacts LemonSqueezy online once, validates your subscription, and unlocks permanently.", bullet_style))
    story.append(Paragraph("<b>Offline Verification:</b> After activation, the license status caches locally, enabling you to use the POS completely offline forever.", body_style))

    # --- SECURITY ---
    story.append(Paragraph("4. Cashier Security & Append-Only Audit Logging", h1_style))
    story.append(Paragraph("To protect store revenues and prevent fraud, Giftshop POS enforces strict Role-Based Access Control and SEC-004 compliant logging.", body_style))
    story.append(Paragraph("• <b>Cashier Profiles:</b> Admins can configure individual profiles with dedicated PINs. Standard cashiers are restricted from editing item prices, adjusting stock sheets, deleting categories, or viewing financial reports.", bullet_style))
    story.append(Paragraph("• <b>SEC-004 Append-Only Audit Trail:</b> Every critical operation (such as manually opening the cash drawer, overriding item retail costs, applying manual discounts, voiding finalized receipts, or updating stock levels) creates an unalterable log record with exact timestamps and supervisor authentication metadata.", bullet_style))

    story.append(PageBreak())

    # --- CHECKOUT & MULTI-CURRENCY ---
    story.append(Paragraph("5. Checkout, Cart & Multi-Currency Sales", h1_style))
    story.append(Paragraph("The primary cashier panel is designed for fast and intuitive checkouts:", body_style))
    story.append(Paragraph("• <b>Cart Controls:</b> Easily increment/decrement quantities, apply item-level or transaction-level discounts, or flag items as 'damaged markdowns' with supervisor approval.", bullet_style))
    story.append(Paragraph("• <b>Multi-Currency Gate:</b> Lock in exchange rates (e.g., EUR, GBP, or USD vs your primary local base currency). Cashiers can toggle secondary currencies on-screen to display equivalent rates to tourists instantly. Finalized receipts list both native paid totals and foreign equivalents side-by-side.", bullet_style))

    # --- VAT TAX MODES ---
    story.append(Paragraph("6. VAT Tax Modes (Inclusive vs Exclusive)", h1_style))
    story.append(Paragraph("Configure your tax preferences inside <b>Admin Settings</b> based on your local regulations:", body_style))
    story.append(Paragraph("• <b>VAT Inclusive Mode:</b> Item shelf prices displayed to customers already incorporate VAT. The system automatically computes and extracts tax fractions on receipt finalization (e.g. 15% VAT component shown on receipts).", bullet_style))
    story.append(Paragraph("• <b>VAT Exclusive Mode:</b> VAT percentages are calculated and appended to the cart subtotal upon final checkout calculation.", bullet_style))
    
    tax_data = [
        [Paragraph("<b>Pricing Mode</b>", body_style), Paragraph("<b>Display to Customers</b>", body_style), Paragraph("<b>Ledger Calculations</b>", body_style)],
        [Paragraph("VAT Inclusive", body_style), Paragraph("Shelf Price = Total Paid", body_style), Paragraph("Net Revenue = Total Paid / (1 + VAT Rate)", body_style)],
        [Paragraph("VAT Exclusive", body_style), Paragraph("Shelf Price + VAT = Total Paid", body_style), Paragraph("Net Revenue = Shelf Price", body_style)]
    ]
    t_tax = Table(tax_data, colWidths=[150, 150, 204])
    t_tax.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), BG_BOX),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_tax)

    story.append(PageBreak())

    # --- CONSIGNMENT ---
    story.append(Paragraph("7. Retail vs. Consignment Inventory & Vendor Ledgers", h1_style))
    story.append(Paragraph("Manage diverse supply lines using the application's integrated Vendor engine:", body_style))
    story.append(Paragraph("• <b>Standard Retail Items:</b> Tracked based on standard Unit Cost Basis vs. Retail Markup. Gross margins are generated upon EOD reports.", bullet_style))
    story.append(Paragraph("• <b>Consignment Items:</b> Tie items to third-party suppliers/local artisans. Configure custom Consignment Cut Rates (e.g. 70% to Vendor, 30% to Store). The database automatically tracks payouts, consignment sales, and outstanding balances.", bullet_style))
    story.append(Paragraph("• <b>Vendor Ledgers:</b> Access live ledgers to record vendor cash advances, log stock returns, and finalize vendor settlement sheets directly from your reports tab.", bullet_style))

    # --- HARDWARE ---
    story.append(Paragraph("8. Hardware Integrations (Printers & Barcode Rules)", h1_style))
    story.append(Paragraph("Connect industry-standard hardware accessories easily:", body_style))
    story.append(Paragraph("• <b>Barcode Scanning:</b> Connect any standard USB/Bluetooth scanner in Keyboard-Wedge mode. The software features an embedded rule engine that supports parsing standard barcode labels as well as PLU-coded scale-labels (parsing weight or embedded cost).", bullet_style))
    story.append(Paragraph("• <b>Receipt Printers (Thermal):</b> Compatible with standard Epson ESC/POS commands (80mm and 58mm). You can upload custom store logos and configure custom footer notes or legal terms on the receipt preview page.", bullet_style))
    story.append(Paragraph("• <b>Business Invoices (A4):</b> Generate full corporate A4 PDF invoices featuring dual-currency equivalents, itemized tax breakdowns, and payment terms.", bullet_style))

    story.append(PageBreak())

    # --- REPORTS ---
    story.append(Paragraph("9. Reports, EOD Balancing & Analytics", h1_style))
    story.append(Paragraph("The suite provides robust dashboards to analyze retail activity:", body_style))
    story.append(Paragraph("• <b>EOD Till-Balancing Reports:</b> Finalized shifts compare actual cash in the drawer vs. expected computer sales, documenting shortages or overages to protect store cash-flow.", bullet_style))
    story.append(Paragraph("• <b>Hourly Forecasting Heatmaps:</b> Visual density grids charting transactional volumes and net revenues across hours and weekdays. Perfect for optimizing store staffing levels and seasonal stock adjustments.", bullet_style))
    story.append(Paragraph("• <b>Tax Downloads:</b> Download compliant CSV ledger spreadsheets detailing gross sales, net revenues, and exact VAT tax collections grouped by department.", bullet_style))

    # --- BACKUPS & TROUBLESHOOTING ---
    story.append(Paragraph("10. Backups, Recovery & Troubleshooting", h1_style))
    story.append(Paragraph("<b>Automated Lossless Snapshots:</b> Every single till closing generates an incremental backup snapshot. You can also trigger manual JSON/SQLite backups to secondary USB drives inside settings.", body_style))

    tr_data = [
        [Paragraph("<b>Symptom</b>", body_style), Paragraph("<b>Possible Cause</b>", body_style), Paragraph("<b>Resolution</b>", body_style)],
        [Paragraph("LemonSqueezy Key Not Accepted", body_style), Paragraph("Typo or wrong purchase email address.", body_style), Paragraph("Verify the purchase email matches the invoice exactly. Paste the key directly to avoid typos.", body_style)],
        [Paragraph("Barcode Scanner Beeps but nothing happens", body_style), Paragraph("The cursor is not focused or scanner is in serial mode.", body_style), Paragraph("Focus your cursor on the active cashier screen. Program the scanner to keyboard-wedge mode.", body_style)],
        [Paragraph("A4 PDF Invoice layout misaligned", body_style), Paragraph("Wrong system paper size.", body_style), Paragraph("Set your printing margins to standard 0.5 in and page sizing to Letter or A4.", body_style)]
    ]
    t_tr = Table(tr_data, colWidths=[130, 130, 244])
    t_tr.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), BG_BOX),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_tr)

    story.append(Spacer(1, 15))
    story.append(HRFlowable(width="100%", thickness=1, color=ACCENT, spaceAfter=8))
    story.append(Paragraph("For commercial support, bulk product licensing, or developer updates, reach out to <b>support@your-store.example.com</b>.", ParagraphStyle('Foot', parent=body_style, alignment=1, textColor=colors.HexColor("#64748B"))))

    p1 = "/Users/alangouffe/Desktop/pos/Giftshop_POS_Official_User_Setup_Guide.pdf"
    p2 = "/Users/alangouffe/Desktop/pos/island-pos-extracted/Giftshop_POS_Official_User_Setup_Guide.pdf"
    
    doc = SimpleDocTemplate(p1, pagesize=letter, leftMargin=54, rightMargin=54, topMargin=64, bottomMargin=64)
    doc.build(story, canvasmaker=NumberedCanvas)
    print("Generated premium bundle PDF at:", p1)
    
    import shutil
    shutil.copy(p1, p2)
    print("Copied premium bundle PDF to:", p2)

if __name__ == '__main__':
    build_pdf()
