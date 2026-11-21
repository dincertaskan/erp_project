"""SUS puanlaması ve 68 eşiğine karşı tek örneklem t-testi.

Girdi CSV sütunları: participant, role, q1 … q10 (1-5). Görev sütunları varsa (ör. task_M1_done,
task_M1_seconds) görev başarı oranı ve ortalama süre de raporlanır.

Kullanım: python sus_score.py yanitlar.csv
"""

import sys
from pathlib import Path

import pandas as pd
from scipy import stats

BENCHMARK = 68  # SUS ortalaması (Sauro ve Lewis)
ITEMS = [f"q{i}" for i in range(1, 11)]


def sus_score(row: pd.Series) -> float:
    total = 0
    for index, item in enumerate(ITEMS, start=1):
        answer = int(row[item])
        if not 1 <= answer <= 5:
            raise ValueError(f"{row['participant']}: {item} 1-5 aralığında olmalı (gelen {answer})")
        total += answer - 1 if index % 2 == 1 else 5 - answer
    return total * 2.5


def main(path: Path) -> None:
    data = pd.read_csv(path)
    missing = [column for column in ["participant", "role", *ITEMS] if column not in data.columns]
    if missing:
        raise SystemExit(f"Eksik sütunlar: {', '.join(missing)}")
    data["sus"] = data.apply(sus_score, axis=1)

    print(data[["participant", "role", "sus"]].to_string(index=False))
    print(f"\nKatılımcı: {len(data)} · Ortalama SUS: {data['sus'].mean():.1f} (SS {data['sus'].std(ddof=1):.1f})")
    print(data.groupby("role")["sus"].agg(["count", "mean", "std"]).round(1).to_string())

    if len(data) >= 2:
        test = stats.ttest_1samp(data["sus"], BENCHMARK)
        print(f"\nTek örneklem t-testi (H0: ortalama = {BENCHMARK}): t={test.statistic:.2f}, p={test.pvalue:.4f}")

    done_columns = [c for c in data.columns if c.startswith("task_") and c.endswith("_done")]
    if done_columns:
        print("\nGörevler:")
        for column in done_columns:
            task = column.removeprefix("task_").removesuffix("_done")
            answered = data[column].dropna()
            rate = (answered.astype(str).str.lower().isin(["evet", "1", "true"])).mean()
            seconds = data.get(f"task_{task}_seconds")
            mean_seconds = (
                f", ort. {seconds.dropna().mean():.0f} sn" if seconds is not None and seconds.notna().any() else ""
            )
            print(f"  {task}: başarı %{rate * 100:.0f} ({len(answered)} kişi){mean_seconds}")


if __name__ == "__main__":
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent / "yanitlar.csv")
