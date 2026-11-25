"""Deney 2 sonuçlarının özeti: sorgu başına medyan süreler, hızlanma oranı ve Mann-Whitney U testi.

Kullanım: python analyze_deney2.py [results/deney2.csv]

İndeksli ve indekssiz ölçümler ayrı koşularda alındığından eşleştirilmiş değildir (aynı tekrar numarası
ortak bir koşul taşımaz); bu yüzden bağımsız iki örneklem için iki yönlü Mann-Whitney U testi kullanılır.
Etki büyüklüğü Cliff's δ'dır (rank-biserial korelasyona eşittir); pozitif değer indekssiz sürelerin genelde daha
uzun olduğunu gösterir. Hızlanma = indekssiz medyan / indeksli medyan; %95 güven aralığı her koşul içinde
ayrı yeniden örnekleme (bootstrap, 10.000 tekrar, yüzdelik yöntemi) ile hesaplanır. p değerleri 9 sorgu için
Holm yöntemiyle de düzeltilir.
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

BOOTSTRAP = 10_000
rng = np.random.default_rng(20261121)


def holm(pvalues: list[float]) -> list[float]:
    order = np.argsort(pvalues)
    m = len(pvalues)
    adjusted = np.empty(m)
    running = 0.0
    for rank, index in enumerate(order):
        running = max(running, (m - rank) * pvalues[index])
        adjusted[index] = min(1.0, running)
    return adjusted.tolist()


def ratio_ci(plain: np.ndarray, indexed: np.ndarray) -> tuple[float, float]:
    plain_medians = np.median(rng.choice(plain, (BOOTSTRAP, len(plain))), axis=1)
    indexed_medians = np.median(rng.choice(indexed, (BOOTSTRAP, len(indexed))), axis=1)
    low, high = np.percentile(plain_medians / indexed_medians, [2.5, 97.5])
    return float(low), float(high)


def main(path: Path) -> None:
    data = pd.read_csv(path)
    data["total_ms"] = data["execution_ms"] + data["planning_ms"]

    rows = []
    for query, group in data.groupby("query"):
        indexed = group[group["condition"] == "indeksli"]["total_ms"].to_numpy()
        plain = group[group["condition"] == "indekssiz"]["total_ms"].to_numpy()
        test = stats.mannwhitneyu(plain, indexed, alternative="two-sided")
        delta = 2 * test.statistic / (len(plain) * len(indexed)) - 1
        low, high = ratio_ci(plain, indexed)
        rows.append(
            {
                "sorgu": query,
                "n": f"{len(indexed)}/{len(plain)}",
                "indeksli_medyan_ms": round(float(np.median(indexed)), 3),
                "indekssiz_medyan_ms": round(float(np.median(plain)), 3),
                "hizlanma_kat": round(float(np.median(plain) / np.median(indexed)), 2),
                "hizlanma_GA95": f"{low:.2f}–{high:.2f}",
                "U": round(float(test.statistic), 1),
                "mannwhitney_p": float(test.pvalue),
                "cliffs_delta": round(float(delta), 2),
            }
        )
    table = pd.DataFrame(rows)
    table["p_Holm"] = holm(table["mannwhitney_p"].tolist())
    for column in ("mannwhitney_p", "p_Holm"):
        table[column] = table[column].map(lambda p: f"{p:.2g}")
    print(table.to_string(index=False))
    print(
        "\nNot: yalnızca sıcak önbellek ölçüldü (tüm ölçümlerde shared_read = "
        f"{int(data['shared_read'].max())}); süre = planlama + yürütme (EXPLAIN ANALYZE), uçtan uca HTTP süresi değil."
    )


if __name__ == "__main__":
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent / "results" / "deney2.csv")
