"""Deney 2 sonuçlarının özeti: sorgu başına medyan süreler, hızlanma ve Wilcoxon işaretli sıralar testi.

Kullanım: python analyze_deney2.py [results/deney2.csv]
"""

import sys
from pathlib import Path

import pandas as pd
from scipy import stats

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent / "results" / "deney2.csv"
data = pd.read_csv(path)
data["total_ms"] = data["execution_ms"] + data["planning_ms"]

rows = []
for query, group in data.groupby("query"):
    indexed = group[group["condition"] == "indeksli"].sort_values("repetition")["total_ms"].to_numpy()
    plain = group[group["condition"] == "indekssiz"].sort_values("repetition")["total_ms"].to_numpy()
    test = stats.wilcoxon(plain, indexed) if len(indexed) == len(plain) and len(indexed) > 5 else None
    rows.append(
        {
            "sorgu": query,
            "indeksli_medyan_ms": round(float(pd.Series(indexed).median()), 3),
            "indekssiz_medyan_ms": round(float(pd.Series(plain).median()), 3),
            "hizlanma_kat": round(float(pd.Series(plain).median() / max(pd.Series(indexed).median(), 1e-9)), 2),
            "wilcoxon_p": round(float(test.pvalue), 5) if test else None,
        }
    )
print(pd.DataFrame(rows).to_string(index=False))
