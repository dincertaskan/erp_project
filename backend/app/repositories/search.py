"""ILIKE aramaları için desen yardımcıları.

Kullanıcının yazdığı %, _ ve \\ karakterleri joker değil düz metin olarak aranır. PostgreSQL'de LIKE/ILIKE
için varsayılan kaçış karakteri ters bölüdür; ayrıca ESCAPE belirtmek gerekmez.
"""


def escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def contains_pattern(term: str) -> str:
    return f"%{escape_like(term)}%"
