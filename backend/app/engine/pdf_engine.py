"""
PDF Engine — ReportLab cash-memo template + SIMULATED watermark.
Pure Python, no FastAPI imports.
"""
from __future__ import annotations

import io
from datetime import datetime
from decimal import Decimal
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.core.config import settings
from app.models import Bill, BillType


# ── Color palette (Clinical Precision) ───────────────────────────────────────

C_NAVY  = colors.HexColor("#0D1B3E")
C_TEAL  = colors.HexColor("#0A7E7E")
C_LIGHT = colors.HexColor("#EAF4F4")
C_GRAY  = colors.HexColor("#6B7280")
C_RED   = colors.HexColor("#DC2626")
C_WHITE = colors.white
C_BLACK = colors.black


# ── Styles ────────────────────────────────────────────────────────────────────

def _make_styles():
    s = getSampleStyleSheet()
    shop_name = ParagraphStyle(
        "ShopName",
        fontName="Helvetica-Bold",
        fontSize=18,
        textColor=C_NAVY,
        alignment=TA_CENTER,
        spaceAfter=2,
    )
    shop_sub = ParagraphStyle(
        "ShopSub",
        fontName="Helvetica",
        fontSize=8,
        textColor=C_TEAL,
        alignment=TA_CENTER,
        spaceAfter=1,
    )
    shop_detail = ParagraphStyle(
        "ShopDetail",
        fontName="Helvetica",
        fontSize=7.5,
        textColor=C_GRAY,
        alignment=TA_CENTER,
        spaceAfter=1,
    )
    section_header = ParagraphStyle(
        "SectionHeader",
        fontName="Helvetica-Bold",
        fontSize=8,
        textColor=C_NAVY,
        alignment=TA_LEFT,
    )
    normal_left = ParagraphStyle(
        "NormalLeft",
        fontName="Helvetica",
        fontSize=8,
        textColor=C_BLACK,
        alignment=TA_LEFT,
    )
    bill_type_badge = ParagraphStyle(
        "BillTypeBadge",
        fontName="Helvetica-Bold",
        fontSize=9,
        textColor=C_WHITE,
        alignment=TA_CENTER,
    )
    footer_style = ParagraphStyle(
        "Footer",
        fontName="Helvetica-Oblique",
        fontSize=7,
        textColor=C_GRAY,
        alignment=TA_CENTER,
    )
    return {
        "shop_name": shop_name,
        "shop_sub": shop_sub,
        "shop_detail": shop_detail,
        "section_header": section_header,
        "normal_left": normal_left,
        "bill_type_badge": bill_type_badge,
        "footer": footer_style,
    }


# ── Watermark canvas (SIMULATED bills only) ───────────────────────────────────

class _WatermarkCanvas:
    """Mixin to draw a diagonal SIMULATED watermark on every page."""

    def __init__(self, *args, **kwargs):
        from reportlab.pdfgen.canvas import Canvas
        super().__init__(*args, **kwargs)

    def showPage(self):
        self._draw_watermark()
        super().showPage()

    def save(self):
        self._draw_watermark()
        super().save()

    def _draw_watermark(self):
        self.saveState()
        self.setFont("Helvetica-Bold", 60)
        self.setFillColor(colors.Color(0.8, 0.1, 0.1, alpha=0.12))
        self.translate(A4[0] / 2, A4[1] / 2)
        self.rotate(40)
        self.drawCentredString(0, 0, "SIMULATED")
        self.restoreState()


def _make_watermark_class():
    from reportlab.pdfgen.canvas import Canvas

    class WatermarkCanvas(_WatermarkCanvas, Canvas):
        pass

    return WatermarkCanvas


# ── Main render function ──────────────────────────────────────────────────────

def render_bill_pdf(bill: Bill) -> bytes:
    """
    Render a cash-memo PDF for `bill`.
    Simulated bills get a diagonal SIMULATED watermark.
    Returns raw PDF bytes.
    """
    buffer = io.BytesIO()
    styles = _make_styles()

    is_simulated = bill.bill_type == BillType.SIMULATED
    canvas_cls = _make_watermark_class() if is_simulated else None

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
        leftMargin=1.8 * cm,
        rightMargin=1.8 * cm,
    )

    story = []

    # ── Shop Header ──────────────────────────────────────────────────────────
    story.append(Paragraph(settings.SHOP_NAME, styles["shop_name"]))
    story.append(Paragraph(settings.SHOP_TAGLINE, styles["shop_sub"]))
    story.append(Paragraph(settings.SHOP_OWNER, styles["shop_detail"]))
    story.append(Paragraph(settings.SHOP_ADDRESS_LINE1, styles["shop_detail"]))
    story.append(Paragraph(settings.SHOP_ADDRESS_LINE2, styles["shop_detail"]))
    story.append(Paragraph(settings.SHOP_PHONE, styles["shop_detail"]))
    story.append(Paragraph(settings.SHOP_GSTIN + "  |  " + settings.SHOP_DL_NUMBER, styles["shop_detail"]))

    story.append(HRFlowable(width="100%", thickness=2, color=C_TEAL, spaceAfter=6))

    # ── Bill Type Badge ───────────────────────────────────────────────────────
    badge_color = C_RED if is_simulated else C_TEAL
    badge_text = "SIMULATED BILL — NOT A REAL TRANSACTION" if is_simulated else "CASH MEMO"
    badge_table = Table(
        [[Paragraph(badge_text, styles["bill_type_badge"])]],
        colWidths=["100%"],
    )
    badge_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), badge_color),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ])
    )
    story.append(badge_table)
    story.append(Spacer(1, 8))

    # ── Bill Meta (bill number, date, mode) ───────────────────────────────────
    meta_left = [
        [Paragraph("<b>Bill No:</b>", styles["normal_left"]),
         Paragraph(bill.bill_number, styles["normal_left"])],
        [Paragraph("<b>Date:</b>", styles["normal_left"]),
         Paragraph(bill.created_at.strftime("%d %b %Y, %I:%M %p"), styles["normal_left"])],
        [Paragraph("<b>Mode:</b>", styles["normal_left"]),
         Paragraph(bill.generation_mode.value if bill.generation_mode else "MANUAL", styles["normal_left"])],
    ]
    meta_right = [
        [Paragraph("<b>Patient:</b>", styles["normal_left"]),
         Paragraph(bill.patient.name if bill.patient else "—", styles["normal_left"])],
        [Paragraph("<b>Patient Code:</b>", styles["normal_left"]),
         Paragraph(bill.patient.patient_code if bill.patient else "—", styles["normal_left"])],
        [Paragraph("<b>Doctor:</b>", styles["normal_left"]),
         Paragraph(f"Dr. {bill.doctor.name}" if bill.doctor else "—", styles["normal_left"])],
    ]

    page_w = A4[0] - 3.6 * cm  # available width
    half = page_w / 2 - 0.5 * cm

    meta_left_t = Table(meta_left, colWidths=[2.5 * cm, half - 2.5 * cm])
    meta_right_t = Table(meta_right, colWidths=[2.7 * cm, half - 2.7 * cm])
    meta_left_t.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    meta_right_t.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))

    meta_combined = Table(
        [[meta_left_t, meta_right_t]],
        colWidths=[page_w / 2, page_w / 2],
    )
    story.append(meta_combined)
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_GRAY, spaceAfter=6))

    # ── Line Items Table ──────────────────────────────────────────────────────
    col_widths = [
        0.6 * cm,    # #
        4.8 * cm,    # Medicine
        3.5 * cm,    # Generic
        2.2 * cm,    # Batch
        2.0 * cm,    # Expiry
        1.8 * cm,    # Unit
        1.5 * cm,    # Qty
        2.2 * cm,    # MRP
        2.2 * cm,    # Amount
    ]

    def _p(txt, style=None, align=TA_LEFT):
        st = style or ParagraphStyle("tmp", fontName="Helvetica", fontSize=7.5, alignment=align)
        return Paragraph(str(txt), st)

    header_style = ParagraphStyle(
        "TH", fontName="Helvetica-Bold", fontSize=7.5,
        textColor=C_WHITE, alignment=TA_CENTER,
    )

    table_data = [
        [_p("#", header_style, TA_CENTER),
         _p("Medicine", header_style),
         _p("Generic", header_style),
         _p("Batch", header_style),
         _p("Expiry", header_style, TA_CENTER),
         _p("Unit", header_style, TA_CENTER),
         _p("Qty", header_style, TA_RIGHT),
         _p("MRP (₹)", header_style, TA_RIGHT),
         _p("Amount (₹)", header_style, TA_RIGHT)],
    ]

    right_style = ParagraphStyle("TR", fontName="Helvetica", fontSize=7.5, alignment=TA_RIGHT)
    center_style = ParagraphStyle("TC", fontName="Helvetica", fontSize=7.5, alignment=TA_CENTER)
    left_style   = ParagraphStyle("TL", fontName="Helvetica", fontSize=7.5, alignment=TA_LEFT)

    for idx, item in enumerate(bill.items, 1):
        table_data.append([
            _p(str(idx), center_style, TA_CENTER),
            _p(item.medicine_name, left_style),
            _p(item.generic_name, left_style),
            _p(item.batch_number, center_style, TA_CENTER),
            _p(item.expiry_date.strftime("%m/%Y"), center_style, TA_CENTER),
            _p(item.unit, center_style, TA_CENTER),
            _p(str(item.quantity), right_style, TA_RIGHT),
            _p(f"{float(item.mrp):.2f}", right_style, TA_RIGHT),
            _p(f"{float(item.line_total):.2f}", right_style, TA_RIGHT),
        ])

    items_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    row_count = len(table_data)
    items_table.setStyle(TableStyle([
        # Header row
        ("BACKGROUND", (0, 0), (-1, 0), C_NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), C_WHITE),
        # Alternating rows
        *[
            ("BACKGROUND", (0, i), (-1, i), C_LIGHT if i % 2 == 0 else C_WHITE)
            for i in range(1, row_count)
        ],
        ("GRID", (0, 0), (-1, -1), 0.3, C_GRAY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 8))

    # ── Totals ────────────────────────────────────────────────────────────────
    totals_data = [
        ["Subtotal", f"₹ {float(bill.subtotal):.2f}"],
    ]
    if float(bill.discount) > 0:
        totals_data.append(["Discount", f"- ₹ {float(bill.discount):.2f}"])
    totals_data.append(["TOTAL", f"₹ {float(bill.total_amount):.2f}"])

    def _total_row_style(i):
        if i == len(totals_data) - 1:  # last row = grand total
            return [
                ("BACKGROUND", (0, i), (-1, i), C_NAVY),
                ("TEXTCOLOR", (0, i), (-1, i), C_WHITE),
                ("FONTNAME", (0, i), (-1, i), "Helvetica-Bold"),
                ("FONTSIZE", (0, i), (-1, i), 10),
            ]
        return [
            ("FONTNAME", (0, i), (0, i), "Helvetica"),
            ("FONTNAME", (1, i), (1, i), "Helvetica"),
        ]

    totals_style = [
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("LINEABOVE", (0, -1), (-1, -1), 1, C_TEAL),
    ]
    for i in range(len(totals_data)):
        totals_style.extend(_total_row_style(i))

    totals_table = Table(totals_data, colWidths=[page_w - 4 * cm, 4 * cm], hAlign="RIGHT")
    totals_table.setStyle(TableStyle(totals_style))
    story.append(totals_table)
    story.append(Spacer(1, 16))

    # ── Notes ─────────────────────────────────────────────────────────────────
    if bill.notes:
        story.append(Paragraph(f"<b>Notes:</b> {bill.notes}", styles["normal_left"]))
        story.append(Spacer(1, 8))

    # ── Footer ────────────────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_GRAY, spaceAfter=6))
    if is_simulated:
        story.append(Paragraph(
            "⚠ This is a SIMULATED bill generated for testing/demonstration purposes only. "
            "It does not represent a real transaction.",
            ParagraphStyle("WarnFooter", fontName="Helvetica-Bold", fontSize=7,
                           textColor=C_RED, alignment=TA_CENTER),
        ))
        story.append(Spacer(1, 4))
    story.append(Paragraph(
        f"{settings.SHOP_NAME}  |  {settings.SHOP_EMAIL}  |  Generated by My Shop v{settings.APP_VERSION}",
        styles["footer"],
    ))
    story.append(Paragraph("Thank you for your patronage!", styles["footer"]))

    # ── Build ─────────────────────────────────────────────────────────────────
    build_kwargs = {}
    if canvas_cls:
        build_kwargs["canvasmaker"] = canvas_cls

    doc.build(story, **build_kwargs)
    return buffer.getvalue()
