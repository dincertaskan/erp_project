"""Raporların Excel çıktısı: başlık, açıklama notu, kalın başlık satırı, para biçimli sütunlar, toplam satırı."""

from collections.abc import Iterable, Sequence
from datetime import datetime
from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter

MONEY_FORMAT = '#,##0.00 "₺"'
DATETIME_FORMAT = "DD.MM.YYYY HH:MM"


def build_xlsx(
    *,
    sheet_title: str,
    title: str,
    note: str | None,
    headers: Sequence[str],
    rows: Iterable[Sequence],
    total_row: Sequence | None = None,
    money_columns: set[int] = frozenset(),
    widths: Sequence[int] = (),
) -> bytes:
    """money_columns: 1'den başlayan sütun numaraları."""
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = sheet_title
    sheet.append([title])
    sheet["A1"].font = Font(bold=True, size=13)
    sheet.append([note] if note else [])
    sheet.append([])

    sheet.append(list(headers))
    header_row = sheet.max_row
    for cell in sheet[header_row]:
        cell.font = Font(bold=True)
        cell.fill = PatternFill("solid", fgColor="F3F4F6")

    for row in rows:
        # Excel saat dilimli tarih kabul etmez; yerel saate çevrilmiş değer yazılır.
        sheet.append([value.replace(tzinfo=None) if isinstance(value, datetime) else value for value in row])
    if total_row is not None:
        sheet.append(list(total_row))
        for cell in sheet[sheet.max_row]:
            cell.font = Font(bold=True)

    # Raporlar yalnızca veri içerir: "=" ile başlayan metinler (ör. müşterinin kendi girdiği ad) formül olarak
    # değil düz metin olarak saklanır (Excel formül enjeksiyonu).
    for row in sheet.iter_rows():
        for cell in row:
            if cell.data_type == "f":
                cell.data_type = "s"

    for row in sheet.iter_rows(min_row=header_row + 1):
        for cell in row:
            if cell.column in money_columns:
                cell.number_format = MONEY_FORMAT
            elif isinstance(cell.value, datetime):
                cell.number_format = DATETIME_FORMAT
    for index, width in enumerate(widths, start=1):
        sheet.column_dimensions[get_column_letter(index)].width = width
    sheet.freeze_panes = sheet.cell(row=header_row + 1, column=1)

    buffer = BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()
