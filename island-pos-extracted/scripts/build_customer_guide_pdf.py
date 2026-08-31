#!/usr/bin/env python3
"""Giftshop POS customer Setup & User Guide PDF."""
from pathlib import Path
import sys
try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
    from reportlab.pdfgen import canvas
except ImportError:
    print("pip install reportlab", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "Giftshop_POS_Customer_Setup_and_User_Guide.pdf"
PRIMARY = colors.HexColor("#0F1115")
ACCENT = colors.HexColor("#0D9488")
ACCENT_L = colors.HexColor("#F0FDF4")
WARN_BG = colors.HexColor("#FFF7ED")
WARN_BD = colors.HexColor("#F59E0B")
ROSE_BG = colors.HexColor("#FFF1F2")
ROSE_BD = colors.HexColor("#E11D48")
TEXT = colors.HexColor("#1E293B")
MUTED = colors.HexColor("#64748B")
BG = colors.HexColor("#F8FAFC")
BORDER = colors.HexColor("#E2E8F0")


class NC(canvas.Canvas):
    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        self._s = []

    def showPage(self):
        self._s.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        n = len(self._s)
        for st in self._s:
            self.__dict__.update(st)
            if self._pageNumber != 1:
                self.saveState()
                self.setFont("Helvetica-Bold", 8)
                self.setFillColor(MUTED)
                self.drawString(54, 750, "GIFTSHOP POS — Customer Setup & User Guide")
                self.setStrokeColor(ACCENT)
                self.line(54, 742, 558, 742)
                self.setFont("Helvetica", 8)
                self.drawString(54, 36, "Trial + Payhip license · Win / Mac / Android")
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
        c=ParagraphStyle("c", parent=b["Normal"], fontName="Courier", fontSize=8, leading=11, textColor=PRIMARY),
        sm=ParagraphStyle("sm", parent=b["Normal"], fontName="Helvetica", fontSize=8, leading=10, textColor=MUTED),
    )


def box(txt, st, bg=ACCENT_L, bd=ACCENT):
    t = Table([[Paragraph(txt, st)]], colWidths=[504])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("BOX", (0, 0), (-1, -1), 1.2, bd),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
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
        Paragraph(
            "Customer Setup Guide · Windows / macOS / Android · Unsigned install workarounds · "
            "14-day trial · Payhip license · Feature manual",
            st["s"],
        ),
        HRFlowable(width="100%", thickness=3, color=ACCENT, spaceAfter=10),
    ]
    meta = [
        [Paragraph("<b>Platforms</b>", st["b"]), Paragraph("Windows (.exe) · macOS (.dmg) · Android (.apk)", st["b"])],
        [Paragraph("<b>Licensing</b>", st["b"]), Paragraph("14-day trial → buy on Payhip → enter license key in app (same installer)", st["b"])],
        [Paragraph("<b>Signing</b>", st["b"]), Paragraph("Builds may be unsigned — follow SmartScreen / Gatekeeper sections below", st["b"])],
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
    story += [
        mt,
        Spacer(1, 10),
        box(
            "<b>Welcome.</b> Install the trial, use the POS for 14 days, then purchase on Payhip. "
            "Enter purchase email + license key in the app. You do <b>not</b> need a different paid binary — "
            "the key unlocks permanently. Re-download from Payhip only if you need the installer again.",
            st["b"],
        ),
        PageBreak(),
    ]
    story += [Paragraph("1. Contents", st["h1"]), HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=6)]
    story += bu([
        "2. Trial vs paid (same app)", "3. Windows install &amp; SmartScreen",
        "4. macOS install, Gatekeeper &amp; damaged-app fix", "5. Android APK",
        "6. Trial timer &amp; activation", "7. Payhip purchase &amp; license key",
        "8. First-Time Setup &amp; Admin Login PIN", "9. Master Reset Password",
        "10. Register sales &amp; receipts", "11–12. Staff, inventory, vendors",
        "13. Reports, History &amp; P&amp;L", "14–15. Backups &amp; security",
        "16. Troubleshooting", "17. Seller: Payhip, variations, GitHub Actions",
    ], st["bu"])
    story.append(PageBreak())
    story += [Paragraph("2. Trial vs paid (same app)", st["h1"]), HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=6)]
    story += bu([
        "One installer for trial and paid use; licensing is inside the app.",
        "Trial: 14 days full features, then activation screen.",
        "After Payhip payment you receive a <b>license key</b> (email + Payhip library).",
        "Activate in-app with checkout email + key. Offline cache after first success.",
        "Re-download after paying is optional (lost installer / new PC) — not required just to unlock.",
    ], st["bu"])
    story += [Spacer(1, 6), box("<b>Paid unlock = license key</b>, not a second unlocked EXE/DMG for customers.", st["b"], WARN_BG, WARN_BD), PageBreak()]

    story += [Paragraph("3. Windows (.exe)", st["h1"]), HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=6), Paragraph("3.1 Install", st["h2"])]
    story += bu([
        "Download the .exe from the trial link or Payhip library.",
        "Run installer → allow UAC if asked → finish wizard → launch The Gift Shop POS.",
    ], st["bu"])
    story += [
        Paragraph("3.2 SmartScreen (Windows protected your PC) — unsigned builds", st["h2"]),
        Paragraph("Independent software without a Microsoft code-signing cert often triggers this. Safe if from the official seller link.", st["b"]),
    ]
    story += bu([
        "Click <b>More info</b> → <b>Run anyway</b>.",
        "If Defender quarantined: Windows Security → Virus &amp; threat protection → Protection history → Allow/Restore.",
        "Optional: right-click .exe → Properties → Unblock → Apply.",
        "Never install from random third-party mirrors.",
    ], st["bu"])
    story.append(PageBreak())

    story += [Paragraph("4. macOS (.dmg)", st["h1"]), HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=6), Paragraph("4.1 Install", st["h2"])]
    story += bu(["Open the branded DMG → drag The Gift Shop POS onto the Applications shortcut → eject → open from Applications."], st["bu"])
    story += [Paragraph("4.2 Unidentified developer (first launch only)", st["h2"])]
    story += bu([
        "The app is ad-hoc signed (not notarized), so macOS asks once. That is <b>normal</b> for trial builds.",
        "Easiest: <b>right-click The Gift Shop POS</b> → <b>Open</b> → click <b>Open</b> again.",
        "Or: System Settings → Privacy &amp; Security → Open Anyway.",
    ], st["bu"])
    story += [
        Paragraph("4.3 App is damaged / moved to Trash (unsigned quarantine)", st["h2"]),
        Paragraph("This affects unsigned downloads only. The app clears its own Gatekeeper flag on the first successful launch, so this is normally a one-time step. If it still shows damaged:", st["b"]),
        box('<font face="Courier">xattr -cr "/Applications/The Gift Shop POS.app"</font>', st["c"], BG, BORDER),
        Paragraph('If the name differs: type <font face="Courier">xattr -cr </font> then drag the app into Terminal. Then right-click → Open.', st["b"]),
        box("<b>Universal DMG:</b> the same DMG works on both Apple silicon (M1–M4) and Intel Macs.", st["b"], WARN_BG, WARN_BD),
        PageBreak(),
    ]

    story += [Paragraph("5. Android (.apk)", st["h1"]), HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=6)]
    story += bu([
        "Enable Install unknown apps for your browser/Files.",
        "Open APK → Install → launch. Grant camera if using barcode scan.",
        "Debug APKs are for evaluation; Play Store release may come later.",
    ], st["bu"])
    story.append(PageBreak())
    story += [Paragraph("6. Trial timer &amp; activation", st["h1"]), HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=6)]
    story += bu([
        "First launch may show days remaining on the trial.",
        "Use register, inventory, reports during the trial.",
        "Buy / Activate opens the seller Payhip URL.",
        "After payment: enter email + license key → Activate → license cached offline.",
    ], st["bu"])
    story.append(PageBreak())

    story += [Paragraph("7. Payhip purchase &amp; license key", st["h1"]), HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=6)]
    story += bu([
        "Checkout with the email you will use for activation.",
        "Payhip emails the order and software license key (when license keys are enabled).",
        "Also check Payhip Library for key + installers + this PDF.",
        "In POS: paste email + key exactly (no extra spaces).",
        "Missing key: spam folder, Payhip library, contact seller with order number.",
    ], st["bu"])
    story.append(PageBreak())

    story += [Paragraph("8. First-Time Setup &amp; Admin Login PIN", st["h1"]), HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=6)]
    story += bu([
        "Fresh install default admin PIN is often <font face=\"Courier\">admin123</font> — change it immediately.",
        "Welcome / First Time Setup: store name + new Admin Login PIN.",
        "After onboarding, pre-login setup entry is disabled (security).",
        "Admin → Store System &amp; Audits → Admin Access Credentials: Admin Login Username and Admin Login PIN.",
    ], st["bu"])
    story.append(PageBreak())

    story += [
        Paragraph("9. Master Reset Password (forgotten admin PIN)", st["h1"]),
        HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=6),
        box("<b>Separate backup secret</b> — not your daily Admin Login PIN. Set it while you still know the admin PIN.", st["b"], ROSE_BG, ROSE_BD),
        Paragraph("Set:", st["h2"]),
    ]
    story += bu([
        "Store System &amp; Audits → Master Reset Password (Backup — forgotten Admin PIN only).",
        "New password (6+ chars) + confirm + current Admin Login PIN → Save. Store offline.",
    ], st["bu"])
    story += [Paragraph("If locked out:", st["h2"])]
    story += bu([
        "Login → Forgot admin PIN? Use Master Reset → enter master reset password.",
        "Admin PIN becomes temporary <font face=\"Courier\">admin123</font> → sign in → change PIN immediately.",
        "Action is audit-logged; attempts are rate-limited.",
    ], st["bu"])
    story.append(PageBreak())

    story += [Paragraph("10. Register sales &amp; receipts", st["h1"]), HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=6)]
    story += bu([
        "Staff PIN → open register/float → scan/search → cart → tender (cash/card/split/FX).",
        "Each sale stores receipt number + timestamp in the transaction ledger.",
        "Reprint from Transaction History (thermal / A4).",
        "Refunds/voids need permission and appear in the security audit trail.",
    ], st["bu"])
    story.append(PageBreak())

    story += [Paragraph("11–12. Staff, inventory, vendors", st["h1"]), HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=6)]
    story += bu([
        "Staff &amp; Cashier Security: create cashiers, PINs, roles, access gates.",
        "Inventory: SKU, stock, VAT, brands, barcodes, CSV import.",
        "Vendors wholesale vs consignment; payouts and settlement reports.",
        "Price lists / registers for retail vs wholesale desks.",
    ], st["bu"])
    story.append(PageBreak())
    story += [
        Paragraph("13. Reports, History &amp; P&amp;L", st["h1"]),
        HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=6),
        Paragraph("Transaction History", st["h2"]),
    ]
    story += bu([
        "Date from/to, search receipt/customer/cashier, sales/refunds/flagged, reprint, integrity check.",
        "Sales live here. Security audit log = exceptions only (not every sale).",
    ], st["bu"])
    story += [Paragraph("Financial / P&amp;L", st["h2"])]
    story += bu([
        "Presets: Daily, Week, This Month, Year, All Time.",
        "Date range, By month, By year — KPIs, Graphs, Pie, CSV all use the same period.",
        "Empty graphs: widen period or confirm sales exist in History.",
    ], st["bu"])
    story.append(PageBreak())

    story += [Paragraph("14–15. Backups &amp; security", st["h1"]), HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=6)]
    story += bu([
        "Export/restore database from Store System &amp; Audits; optional auto-backup.",
        "Backups are sensitive (may include credentials).",
        "Change default PIN day one; set Master Reset; do not leave admin logged in on the floor.",
        "Protect license keys and Master Reset like passwords.",
    ], st["bu"])
    story.append(PageBreak())

    story += [Paragraph("16. Troubleshooting", st["h1"]), HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=6)]
    rows = [
        [Paragraph("<b>Issue</b>", st["b"]), Paragraph("<b>Try</b>", st["b"])],
        [Paragraph("Mac damaged/can't open", st["b"]), Paragraph("xattr -cr on .app; right-click Open; Open Anyway", st["b"])],
        [Paragraph("Windows SmartScreen", st["b"]), Paragraph("More info → Run anyway; restore from Defender history", st["b"])],
        [Paragraph("Key rejected", st["b"]), Paragraph("Exact purchase email; internet for first verify; contact seller", st["b"])],
        [Paragraph("Forgot admin PIN", st["b"]), Paragraph("Master Reset if configured; else restore backup", st["b"])],
        [Paragraph("Empty P&amp;L graphs", st["b"]), Paragraph("This Month / Date range; Graphs tab; check History", st["b"])],
    ]
    tw = Table(rows, colWidths=[150, 354])
    tw.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BG),
        ("BOX", (0, 0), (-1, -1), 1, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story += [tw, PageBreak()]

    story += [
        Paragraph("17. Seller: Payhip, variations, GitHub Actions", st["h1"]),
        HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=6),
        Paragraph("17.1 Payhip product", st["h2"]),
    ]
    story += bu([
        "One product: Giftshop POS License with Software License Keys enabled.",
        "Attach: Windows exe, macOS dmg, optional apk, this PDF.",
        "Copy Product Secret → GitHub secret VITE_PAYHIP_PRODUCT_SECRET on Giftshop repo.",
        "Set VITE_PURCHASE_URL to the Payhip product/checkout link.",
        "Free/trial listing can share the same installers; paid product delivers the key.",
    ], st["bu"])
    story += [
        Paragraph("17.2 Variations vs LemonSqueezy", st["h2"]),
        Paragraph("Payhip is simpler. Recommended patterns:", st["b"]),
    ]
    story += bu([
        "<b>Single product + license keys</b> (best): one price, multi-file download, lifetime unlock via key.",
        "<b>Multiple products</b> for add-ons (training, extra site) as separate Payhip products.",
        "Free product = trial files; paid product = same files + license email. No second unlocked binary required.",
        "Payhip does not fully mirror LemonSqueezy multi-variant + advanced license API in one SKU — use separate products for complex bundles.",
    ], st["bu"])
    story += [Paragraph("17.3 Build on GitHub (no Mac required)", st["h2"])]
    story += bu([
        "Giftshop repo = customer trial builds (do not set VITE_DISABLE_LICENSE).",
        "Actions → Build Gift Shop POS Releases → Run workflow → download win/mac + setup-guide PDF artifacts.",
        "Optional Android workflow for APK.",
        "ownervs repo: variable VITE_DISABLE_LICENSE=1 for your unlocked tests only — never sell those.",
        "Upload Giftshop artifacts + PDF to Payhip; test one full purchase → activate in app.",
    ], st["bu"])
    story += [
        Spacer(1, 12),
        HRFlowable(width="100%", thickness=2, color=ACCENT, spaceAfter=6),
        Paragraph("© Giftshop POS · Support: contact on your Payhip receipt. Guide generated for customer distribution.", st["sm"]),
    ]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54,
        title="Giftshop POS Customer Setup & User Guide",
        author="Giftshop POS",
    )
    doc.build(story, canvasmaker=NC)
    print("Wrote", OUT)
    return OUT


if __name__ == "__main__":
    build()
