# Üçüncü Taraf Lisansları

Projede doğrudan kullanılan paketlerin ve dış kaynakların lisansları. Sürümler `backend/requirements*.txt` ve `frontend/package.json` dosyalarındaki sabit sürümlerdir. Lisanslar kurulu paketlerin üst verisinden (Python için `importlib.metadata`, npm için `node_modules/<paket>/package.json`) okunmuştur. Dolaylı (geçişli) bağımlılıklar listelenmemiştir.

## Arka uç (Python)

### Çalışma zamanı (`backend/requirements.txt`)

| Paket | Sürüm | Lisans |
|---|---|---|
| alembic | 1.20.1 | MIT |
| bcrypt | 5.0.0 | Apache-2.0 |
| email-validator | 2.4.0 | Unlicense |
| fastapi | 0.165.0 | MIT |
| openpyxl | 3.1.5 | MIT |
| psycopg[binary] | 3.3.9 | LGPL-3.0-only (psycopg-binary 3.3.9 de LGPL-3.0-only) |
| pydantic | 2.14.4 | MIT |
| pydantic-settings | 2.16.3 | MIT |
| PyJWT | 2.15.1 | MIT |
| python-dotenv | 1.2.4 | BSD-3-Clause |
| SQLAlchemy | 2.1.9 | MIT |
| tzdata | 2026.6 | Apache-2.0 |
| uvicorn | 0.54.0 | BSD-3-Clause |

### Geliştirme ve test (`backend/requirements-dev.txt`)

| Paket | Sürüm | Lisans |
|---|---|---|
| httpx | 0.28.1 | BSD-3-Clause |
| pytest | 9.2.0 | MIT |
| pytest-cov | 7.1.0 | MIT |
| ruff | 0.17.6 | MIT |

## Önyüz (npm)

### Çalışma zamanı (`dependencies`)

| Paket | Sürüm | Lisans |
|---|---|---|
| @ant-design/icons | 5.6.1 | MIT |
| @ant-design/plots | 2.6.7 | MIT |
| @ant-design/pro-components | 2.8.10 | MIT |
| @fontsource-variable/inter | 5.3.0 | OFL-1.1 |
| @tanstack/react-query | 5.108.2 | MIT |
| antd | 5.29.3 | MIT |
| axios | 1.21.1 | MIT |
| dayjs | 1.11.23 | MIT |
| react | 18.3.1 | MIT |
| react-dom | 18.3.1 | MIT |
| react-router-dom | 7.18.6 | MIT |

### Geliştirme ve test (`devDependencies`)

| Paket | Sürüm | Lisans |
|---|---|---|
| @testing-library/dom | 10.4.2 | MIT |
| @testing-library/jest-dom | 8.0.0 | MIT |
| @testing-library/react | 16.3.3 | MIT |
| @testing-library/user-event | 14.6.13 | MIT |
| @types/node | 22.20.5 | MIT |
| @types/react | 18.3.31 | MIT |
| @types/react-dom | 18.3.7 | MIT |
| @vitejs/plugin-react | 6.3.0 | MIT |
| jsdom | 31.0.1 | MIT |
| @vitest/coverage-v8 | 5.1.0 | MIT |
| oxlint | 1.94.0 | MIT |
| prettier | 3.10.1 | MIT |
| typescript | 5.9.3 | Apache-2.0 |
| vite | 8.3.8 | MIT |
| vitest | 5.1.0 | MIT |

## Veri ve yazı tipi

| Kaynak | Kullanım | Lisans |
|---|---|---|
| Brazilian E-Commerce Public Dataset by Olist (Kaggle, Olist) | Demo ve ölçüm verisi (`app.olist` aktarımı). Müşteri adları ve e-postaları anonimleştirilir | CC BY-NC-SA 4.0 |
| Inter yazı tipi (The Inter Project Authors) | Arayüz yazı tipi, `@fontsource-variable/inter` paketiyle | SIL Open Font License 1.1 |

## Notlar

- psycopg LGPL-3.0 lisanslıdır; proje kütüphaneyi değiştirmeden, paket olarak kullanır.
- Olist veri seti ticari olmayan kullanım şartı taşır (NC) ve türetilmiş verinin aynı lisansla paylaşılmasını ister (SA). Veri seti depoya eklenmez; `backend/data/olist/` klasörü git dışındadır.
- Bağımlılık sürümleri değiştiğinde bu tablo güncellenmelidir.
