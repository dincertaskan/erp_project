"""Kullanım: python -m app.olist --data-dir data/olist [--sample 1000] [--reset] [--scale 10]"""

import argparse
import sys
import time
from pathlib import Path

from app.core.database import SessionLocal
from app.olist.importer import OlistError, OlistImporter, Summary


def main() -> int:
    parser = argparse.ArgumentParser(description="Olist açık veri setini veritabanına aktarır.")
    parser.add_argument("--data-dir", type=Path, default=Path("data/olist"), help="CSV dosyalarının klasörü")
    parser.add_argument("--sample", type=int, help="Yalnızca en eski N siparişi yükle (demo ve CI için)")
    parser.add_argument("--reset", action="store_true", help="Önceki Olist kayıtlarını silip yeniden yükle")
    parser.add_argument("--scale", type=int, default=1, help="Siparişleri N kat çoğalt (Deney 2)")
    args = parser.parse_args()

    started = time.perf_counter()
    with SessionLocal() as db:
        importer = OlistImporter(db, args.data_dir)
        summary = Summary()
        try:
            importer.check_files()
            if importer.already_loaded():
                if not args.reset:
                    print("Olist verisi zaten yüklü. Yeniden yüklemek için --reset kullanın.", file=sys.stderr)
                    return 1
                importer.reset(summary)
                print(f"Silinenler: {summary.deleted}")
            summary = importer.load(sample=args.sample, scale=max(1, args.scale))
        except OlistError as exc:
            print(f"Hata: {exc}", file=sys.stderr)
            return 1

    elapsed = time.perf_counter() - started
    print(
        f"Tamamlandı ({elapsed:.1f} sn): {summary.categories} yeni kategori, {summary.products} ürün, "
        f"{summary.customers} müşteri, {summary.orders} sipariş, {summary.order_items} sipariş kalemi."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
