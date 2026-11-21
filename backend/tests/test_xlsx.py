from io import BytesIO

from openpyxl import load_workbook

from app.services.xlsx import build_xlsx


def test_text_starting_with_equals_is_not_written_as_a_formula():
    content = build_xlsx(
        sheet_title="Test",
        title="Başlık",
        note=None,
        headers=["Müşteri", "Tutar"],
        rows=[['=HYPERLINK("http://ornek.test","Tikla")', 10], ["=1+1", 5]],
    )

    sheet = load_workbook(BytesIO(content)).active
    cells = [sheet.cell(row=row, column=1) for row in (5, 6)]

    assert [cell.value for cell in cells] == ['=HYPERLINK("http://ornek.test","Tikla")', "=1+1"]
    assert all(cell.data_type == "s" for cell in cells)
