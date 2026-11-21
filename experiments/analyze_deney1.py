"""Deney 1 sonuçlarının özeti ve istatistik testleri.

Kullanım: python analyze_deney1.py [results/deney1.csv]

Strateji ve eşzamanlılık düzeyine göre ortalama fazla satış, kayıp güncelleme, başarısız istek oranı ve
yanıt süreleri; stratejiler arasında p95 süresi için Kruskal-Wallis ve tek yönlü ANOVA.
"""

import sys
from pathlib import Path

import pandas as pd
from scipy import stats

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent / "results" / "deney1.csv"
data = pd.read_csv(path)

summary = (
    data.groupby(["strategy", "concurrency"])
    .agg(
        runs=("repetition", "count"),
        oversell_mean=("oversell", "mean"),
        lost_updates_mean=("lost_updates", "mean"),
        approved_mean=("approved", "mean"),
        failure_rate_mean=("failure_rate", "mean"),
        mean_ms=("mean_ms", "mean"),
        p95_ms=("p95_ms", "mean"),
    )
    .round(2)
)
print("Özet (koşu ortalamaları):")
print(summary.to_string())

print("\nStratejiler arası p95 yanıt süresi karşılaştırması (her eşzamanlılık düzeyi ayrı):")
for concurrency, group in data.groupby("concurrency"):
    samples = [g["p95_ms"].to_numpy() for _, g in group.groupby("strategy")]
    if len(samples) < 2 or min(len(s) for s in samples) < 2:
        print(f"  N={concurrency}: yeterli koşu yok")
        continue
    kruskal = stats.kruskal(*samples)
    anova = stats.f_oneway(*samples)
    print(
        f"  N={concurrency}: Kruskal-Wallis H={kruskal.statistic:.2f} p={kruskal.pvalue:.4f} · "
        f"ANOVA F={anova.statistic:.2f} p={anova.pvalue:.4f}"
    )
