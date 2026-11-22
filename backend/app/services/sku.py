"""Kategori adından SKU öneki üretimi: ilk harf ve ardından gelen ilk iki ünsüz (Elektronik -> ELK)."""

TRANSLITERATION = str.maketrans("ÇĞİÖŞÜÂÎÛ", "CGIOSUAIU")
VOWELS = set("AEIOU")


def sku_prefix(category_name: str) -> str:
    letters = [ch for ch in category_name.upper().translate(TRANSLITERATION) if "A" <= ch <= "Z"]
    if not letters:
        return "URN"
    prefix = [letters[0]] + [ch for ch in letters[1:] if ch not in VOWELS][:2]
    # Ünsüz yetmezse kalan harflerle tamamlanır.
    for ch in letters[1:]:
        if len(prefix) >= 3:
            break
        if ch in VOWELS:
            prefix.append(ch)
    return "".join(prefix[:3]).ljust(3, "X")


def next_sku(prefix: str, existing: list[str]) -> str:
    """Önekle başlayan kodlardaki en büyük sayının bir fazlası, dört haneli."""
    numbers = []
    for sku in existing:
        suffix = sku.removeprefix(f"{prefix}-")
        if suffix != sku and suffix.isdigit():
            numbers.append(int(suffix))
    return f"{prefix}-{max(numbers, default=0) + 1:04d}"
