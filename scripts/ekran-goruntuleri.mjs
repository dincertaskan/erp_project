// Kullanıcı kılavuzu ekran görüntüleri: yüklü Chrome'u başsız modda DevTools protokolüyle sürer (dış paket yok).
// Kullanım (uygulama ve demo hesaplar çalışırken, Node 22+):
//   ERP_PASSWORD=<demo şifresi> node scripts/ekran-goruntuleri.mjs docs/images
// İsteğe bağlı: ERP_APP_URL, ERP_API_URL, CHROME_PATH.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const APP = process.env.ERP_APP_URL ?? 'http://localhost:5173';
const API = process.env.ERP_API_URL ?? 'http://localhost:8000';
const OUT = process.argv[2] ?? 'docs/images';
const PASSWORD = process.env.ERP_PASSWORD;
if (!PASSWORD) throw new Error('ERP_PASSWORD ortam değişkeni gerekli.');
const PORT = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

const profile = join(tmpdir(), `erp-shots-${Date.now()}`);
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--window-size=1440,900', '--hide-scrollbars', '--lang=tr-TR', 'about:blank',
]);

async function json(url, init) {
  for (let i = 0; i < 50; i++) {
    try { return await (await fetch(url, init)).json(); } catch { await sleep(200); }
  }
  throw new Error(`no response: ${url}`);
}

const targets = await json(`http://127.0.0.1:${PORT}/json/list`);
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let nextId = 1;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) =>
  (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

async function login(email) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }),
  });
  return (await res.json());
}

async function go(path, wait = 2500) {
  await send('Page.navigate', { url: APP + path });
  await sleep(wait);
}

async function shot(name, { script, wait = 800, fullPage = false } = {}) {
  if (script) { await evaluate(script); await sleep(wait); }
  let clip;
  if (fullPage) {
    const h = await evaluate('Math.min(document.documentElement.scrollHeight, 2200)');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: h, deviceScaleFactor: 1, mobile: false });
    await sleep(600);
  }
  const { data } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 82, clip });
  writeFileSync(join(OUT, `${name}.jpg`), Buffer.from(data, 'base64'));
  if (fullPage) await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  console.log('ok', name);
}

async function as(email) {
  const session = await login(email);
  await go('/login', 1200);
  await evaluate(`localStorage.clear(); localStorage.setItem('erp.token', ${JSON.stringify(session.access_token)}); true`);
  return session;
}

const clickText = (selector, text) =>
  `(() => { const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find(e => e.textContent.trim().includes(${JSON.stringify(text)})); if (el) el.click(); return !!el; })()`;

// --- Herkese açık ekranlar
await go('/login');
await shot('01-giris');
await go('/register');
await shot('02-kayit');

// --- Müşteri
const customer = await as('musteri@example.com');
await go('/shop', 3000);
await shot('10-musteri-katalog');
const products = await (await fetch(`${API}/catalog/products?page_size=50&in_stock=true&sort=name`, {
  headers: { Authorization: `Bearer ${customer.access_token}` },
})).json();
const pick = products.items.find((p) => p.sku.startsWith('OFS')) ?? products.items[0];
await go(`/shop/products/${pick.id}`);
await shot('11-musteri-urun-detayi');
const cart = [{ productId: pick.id, name: pick.name, sku: pick.sku, imageUrl: pick.image_url, price: pick.sale_price, availableQty: pick.available_qty, quantity: 2 }];
await evaluate(`localStorage.setItem('erp.cart.${customer.user.id}', ${JSON.stringify(JSON.stringify(cart))}); true`);
await go('/shop/cart', 3000);
await shot('12-musteri-sepet');
await evaluate(`localStorage.removeItem('erp.cart.${customer.user.id}'); true`);
await go('/shop/orders', 2500);
await shot('13-musteri-siparislerim');
const mine = await (await fetch(`${API}/me/orders?page_size=1`, { headers: { Authorization: `Bearer ${customer.access_token}` } })).json();
if (mine.items[0]) { await go(`/shop/orders/${mine.items[0].id}`); await shot('14-musteri-siparis-detayi'); }

// --- Depo personeli
await as('depo@example.com');
await go('/stock', 3000);
await shot('20-depo-stok-islemleri');
await shot('21-depo-stok-giris-cikis', { script: clickText('.ant-table-tbody button', 'Giriş'), wait: 1200 });
await go('/stock/movements', 3000);
await shot('22-depo-stok-hareketleri');
await go('/stock/critical', 3000);
await shot('23-depo-kritik-stok');

// --- Yönetici
const admin = await as('yonetici@example.com');
await go('/dashboard', 4500);
await shot('30-yonetici-dashboard', { fullPage: true });
await go('/products', 3000);
await shot('31-yonetici-urunler');
await shot('32-yonetici-urun-formu', { script: clickText('button', 'Yeni Ürün'), wait: 1200 });
await go('/products/1', 3000);
await shot('33-yonetici-urun-detayi');
await go('/categories', 2500);
await shot('34-yonetici-kategoriler');
await go('/orders', 3000);
await shot('35-yonetici-siparisler');
const pendingOrders = await (await fetch(`${API}/orders?status=pending&page_size=20`, { headers: { Authorization: `Bearer ${admin.access_token}` } })).json();
const withShortage = [];
for (const o of pendingOrders.items) {
  const d = await (await fetch(`${API}/orders/${o.id}`, { headers: { Authorization: `Bearer ${admin.access_token}` } })).json();
  if (d.shortages?.length) withShortage.push(d.id);
}
if (withShortage[0]) { await go(`/orders/${withShortage[0]}`, 3000); await shot('36-yonetici-siparis-detayi-eksik-stok'); }
await go('/orders/new', 2500);
await shot('37-yonetici-yeni-siparis');
await go('/customers', 3000);
await shot('38-yonetici-musteriler');
await go('/customers/1', 3000);
await shot('39-yonetici-musteri-detayi');
await go('/reports', 4000);
await shot('40-yonetici-raporlar', { fullPage: true });
await go('/users', 3000);
await shot('41-yonetici-kullanicilar');
await go('/profile', 2500);
await shot('42-profil');

ws.close();
chrome.kill();
