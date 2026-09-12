// Pemeriksa berkas konfigurasi Nginx yang berjalan dengan Node.js saja.
// Jalankan: node scripts/periksa-nginx.mjs nginx.conf
import { readFileSync } from 'node:fs';

const berkas = process.argv[2] ?? 'nginx.conf';
const isi = readFileSync(berkas, 'utf8');

// Buang komentar, tetapi hormati tanda kutip supaya tanda # di dalam nilai aman.
function tanpaKomentar(teks) {
  let hasil = '';
  let kutip = null;
  for (let i = 0; i < teks.length; i++) {
    const c = teks[i];
    if (kutip) {
      hasil += c;
      if (c === kutip && teks[i - 1] !== '\\') kutip = null;
      continue;
    }
    if (c === '"' || c === "'") { kutip = c; hasil += c; continue; }
    if (c === '#') { while (i < teks.length && teks[i] !== '\n') i++; hasil += '\n'; continue; }
    hasil += c;
  }
  return hasil;
}

const bersih = tanpaKomentar(isi);
const masalah = [];

// Menghilangkan titik koma membuat dua baris menyatu, sehingga jumlah titik koma
// pada baris itu menjadi kurang dari jumlah pernyataannya.
bersih.split('\n').forEach((baris, nomor) => {
  const t = baris.trim();
  if (!t) return;

  const kurungBuka = (t.match(/\{/g) ?? []).length;
  const kurungTutup = (t.match(/\}/g) ?? []).length;
  const titikKoma = (t.match(/;/g) ?? []).length;

  if (kurungBuka > 0 && kurungTutup === 0) {
    if (!t.replace(/[{};]/g, '').trim()) {
      masalah.push(`baris ${nomor + 1}: blok dibuka tanpa nama directive di depannya`);
    }
    return;
  }
  if (kurungBuka === 0 && kurungTutup > 0 && titikKoma === 0) return;

  if (titikKoma === 0) {
    masalah.push(`baris ${nomor + 1}: "${t.slice(0, 50)}" tidak diakhiri titik koma`);
    return;
  }
  if (titikKoma > 1 && kurungBuka === 0) {
    masalah.push(`baris ${nomor + 1}: ada ${titikKoma} pernyataan tanpa blok`);
  }
});

const totalBuka = (bersih.match(/\{/g) ?? []).length;
const totalTutup = (bersih.match(/\}/g) ?? []).length;
if (totalBuka !== totalTutup) {
  masalah.push(`kurung kurawal tidak seimbang, ${totalBuka} buka dan ${totalTutup} tutup`);
}

const proxy = [...bersih.matchAll(/proxy_pass\s+([^;]+);/g)].map((m) => m[1].trim());
const adaResolver = /resolver\s+[^;]+;/.test(bersih);

if (proxy.some((p) => p.startsWith('$')) && !adaResolver) {
  masalah.push('proxy_pass memakai variabel tanpa directive resolver, nama upstream tidak akan terselesaikan');
}
if (!/server\s*\{/.test(bersih)) masalah.push('tidak ada blok server');
if (!/listen\s+\d+/.test(bersih)) masalah.push('tidak ada directive listen');
if (proxy.length === 0) masalah.push('tidak ada proxy_pass sama sekali');

console.log(`Berkas       : ${berkas}`);
console.log(`proxy_pass   : ${proxy.length > 0 ? proxy.join(', ') : '(tidak ada)'}`);
console.log(`resolver     : ${adaResolver ? 'ada' : 'tidak ada'}`);

if (masalah.length === 0) {
  console.log('HASIL: struktur konfigurasi valid');
  process.exit(0);
}
console.log(`HASIL: ${masalah.length} masalah`);
for (const m of masalah) console.log(` - ${m}`);
process.exit(1);