"""Deney 1 sonuçlarının özeti ve istatistik testleri.

Kullanım: python analyze_deney1.py [results/deney1.csv]

Strateji ve eşzamanlılık düzeyine (N) göre:
- onaylanan sipariş, başarı oranı, fazla satış, kayıp güncelleme, başarısız istek oranı;
- koşu başına ortalama ve p95 yanıt süresinin koşular arası ortalaması, medyanı ve çeyrekler açıklığı (IQR);
- her N için stratejiler arasında Kruskal-Wallis (etki büyüklüğü ε²) ve tek yönlü ANOVA;
  ardından Holm düzeltmeli Dunn ikili karşılaştırmaları ve Cliff's δ;
- ısınma etkisi: her koşulun ilk koşusu ile kalan koşular; duyarlılık analizi olarak ilk koşu
  (ve ilk 5 koşu) çıkarılarak testlerin tekrarı.

CSV'de istek düzeyinde veri yoktur; her satır bir koşunun özetidir. Yalnızca başarılı onayların süresi ve
saniyede başarılı onay sayısı, CSV'de ilgili sütunlar (ok_mean_ms, ok_p95_ms, ok_per_s) varsa raporlanır.
"""

import sys
from itertools import combinations
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

STRATEGIES = ["none", "pessimistic", "optimistic"]
METRICS = {"p95_ms": "p95 süresi", "mean_ms": "ortalama süre"}


def holm(pvalues: list[float]) -> list[float]:
    """Holm-Bonferroni düzeltmesi."""
    order = np.argsort(pvalues)
    m = len(pvalues)
    adjusted = np.empty(m)
    running = 0.0
    for rank, index in enumerate(order):
        running = max(running, (m - rank) * pvalues[index])
        adjusted[index] = min(1.0, running)
    return adjusted.tolist()


def cliffs_delta(x: np.ndarray, y: np.ndarray) -> float:
    """P(X > Y) - P(X < Y); pozitif değer x'in genelde büyük olduğunu gösterir."""
    return float(np.sign(np.subtract.outer(x, y)).mean())


def dunn(samples: dict[str, np.ndarray]) -> list[tuple[str, str, float, float]]:
    """Dunn testi (bağ düzeltmeli, iki yönlü); (a, b, z, ham p) listesi."""
    values = np.concatenate(list(samples.values()))
    ranks = stats.rankdata(values)
    n = len(values)
    _, ties = np.unique(values, return_counts=True)
    tie_term = (ties**3 - ties).sum() / (12 * (n - 1))
    mean_ranks, sizes, start = {}, {}, 0
    for name, sample in samples.items():
        mean_ranks[name] = ranks[start : start + len(sample)].mean()
        sizes[name] = len(sample)
        start += len(sample)
    results = []
    for a, b in combinations(samples, 2):
        se = np.sqrt((n * (n + 1) / 12 - tie_term) * (1 / sizes[a] + 1 / sizes[b]))
        z = (mean_ranks[a] - mean_ranks[b]) / se
        results.append((a, b, float(z), float(2 * stats.norm.sf(abs(z)))))
    return results


def iqr_text(series: pd.Series) -> str:
    q1, q3 = np.percentile(series, [25, 75])
    return f"{q1:.0f}–{q3:.0f}"


def summary(data: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for strategy in STRATEGIES:
        for concurrency, g in data[data["strategy"] == strategy].groupby("concurrency"):
            rows.append(
                {
                    "strateji": strategy,
                    "N": concurrency,
                    "kosu": len(g),
                    "onay_ort": round(g["approved"].mean(), 2),
                    "basari_orani": round((g["approved"] / g["concurrency"]).mean(), 3),
                    "fazla_satis": round(g["oversell"].mean(), 2),
                    "kayip_guncelleme": round(g["lost_updates"].mean(), 2),
                    "basarisiz_oran": round(g["failure_rate"].mean(), 2),
                    "ort_ms_ort": round(g["mean_ms"].mean(), 1),
                    "ort_ms_medyan": round(g["mean_ms"].median(), 1),
                    "p95_ort": round(g["p95_ms"].mean(), 1),
                    "p95_medyan": round(g["p95_ms"].median(), 1),
                    "p95_IQR": iqr_text(g["p95_ms"]),
                }
            )
    return pd.DataFrame(rows)


def compare(data: pd.DataFrame, metric: str) -> None:
    for concurrency, group in data.groupby("concurrency"):
        samples = {s: group[group["strategy"] == s][metric].to_numpy() for s in STRATEGIES}
        samples = {s: v for s, v in samples.items() if len(v) >= 2}
        if len(samples) < 2:
            print(f"  N={concurrency}: yeterli koşu yok")
            continue
        n, k = sum(len(v) for v in samples.values()), len(samples)
        kruskal = stats.kruskal(*samples.values())
        epsilon2 = (kruskal.statistic - k + 1) / (n - k)
        anova = stats.f_oneway(*samples.values())
        print(
            f"  N={concurrency}: Kruskal-Wallis H={kruskal.statistic:.2f} p={kruskal.pvalue:.2g} ε²={epsilon2:.2f}"
            f" · ANOVA F={anova.statistic:.2f} p={anova.pvalue:.2g}"
        )
        pairs = dunn(samples)
        adjusted = holm([p for *_, p in pairs])
        for (a, b, z, _), p_holm in zip(pairs, adjusted, strict=True):
            delta = cliffs_delta(samples[a], samples[b])
            print(
                f"      {a} – {b}: Dunn z={z:+.2f} p_Holm={p_holm:.2g} · Cliff's δ={delta:+.2f}"
                f" (medyan {np.median(samples[a]):.0f} / {np.median(samples[b]):.0f} ms)"
            )


def warmup(data: pd.DataFrame) -> None:
    """Her koşulun ilk koşusunu, kalan koşuların Tukey üst sınırıyla (Q3 + 1,5·IQR) karşılaştırır."""
    print("\nIsınma kontrolü (p95, ms): ilk koşu · ilk 5 koşu · kalan koşuların medyanı · Tukey üst sınırı")
    for strategy in STRATEGIES:
        for concurrency, g in data[data["strategy"] == strategy].groupby("concurrency"):
            g = g.sort_values("repetition")
            rest = g[g["repetition"] > 1]["p95_ms"]
            q1, q3 = np.percentile(rest, [25, 75])
            fence = q3 + 1.5 * (q3 - q1)
            first = g["p95_ms"].iloc[0]
            flag = "aykırı" if first > fence else "-"
            first5 = " ".join(f"{v:.0f}" for v in g["p95_ms"].iloc[:5])
            print(
                f"  {strategy:<12} N={concurrency:<4} {first:>5.0f} · [{first5}] · {rest.median():.0f}"
                f" · {fence:.0f} → {flag}"
            )


def main(path: Path) -> None:
    data = pd.read_csv(path)

    print(
        "Not: p95_ms, koşudaki N isteğin p95 süresidir. Bu CSV, sıralı listede round(0,95·N)'inci değeri\n"
        "alan eski formülle üretildi: N=10'da bu değer koşunun en yavaş isteğine (maksimum) eşittir;\n"
        "N=50'de 48./50, N=100'de 95./100 değerdir. deney1.py artık doğrusal enterpolasyonlu yüzdelik\n"
        "(numpy.percentile, linear) kullanır. Mevcut koşular yeniden hesaplanamaz (istek düzeyinde süre\n"
        "saklanmadı); bu yüzden p95 yanında koşu ortalama süresi (mean_ms) de test edilmiştir."
    )

    print("\nÖzet (koşu düzeyinde; süreler ms; IQR = 1.–3. çeyrek):")
    print(summary(data).to_string(index=False))

    if {"ok_mean_ms", "ok_p95_ms", "ok_per_s"} <= set(data.columns):
        print("\nYalnızca başarılı onaylar (koşu medyanı):")
        ok = data.groupby(["strategy", "concurrency"])[["ok_mean_ms", "ok_p95_ms", "ok_per_s"]].median()
        print(ok.round(1).to_string())
    else:
        print(
            "\nYalnızca başarılı onayların süresi ve saniyede başarılı onay sayısı bu CSV'den hesaplanamaz:\n"
            "istek düzeyinde süreler ve koşu süresi saklanmadı. Süreler, stratejiye göre farklı oranda hızlı\n"
            "reddedilen istekleri de içerir (pessimistic: stok yetersiz, optimistic: 409); süre farkları\n"
            "'aynı işi daha hızlı yapma' olarak yorumlanmamalıdır."
        )

    for metric, label in METRICS.items():
        print(f"\nStratejiler arası {label} karşılaştırması (her N ayrı; tüm koşular):")
        compare(data, metric)

    warmup(data)

    for skip in (1, 5):
        trimmed = data[data["repetition"] > skip]
        label = "ilk koşusu" if skip == 1 else f"ilk {skip} koşusu"
        print(f"\nDuyarlılık analizi: her koşulun {label} çıkarıldı")
        print(summary(trimmed)[["strateji", "N", "kosu", "p95_ort", "p95_medyan", "p95_IQR"]].to_string(index=False))
        compare(trimmed, "p95_ms")


if __name__ == "__main__":
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent / "results" / "deney1.csv")
