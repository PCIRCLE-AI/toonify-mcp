# 🎯 Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Server MCP + Plugin Claude Code yang menyediakan optimasi token otomatis untuk data terstruktur **dan kode sumber**.
Mengurangi penggunaan token Claude API sebesar **25-66%** untuk JSON/CSV/YAML dan **20-48%** untuk kode sumber TypeScript/Python/Go melalui arsitektur pipeline.

## Fitur Baru di v0.6.0

✨ **Arsitektur pipeline + kompresi kode!**
- ✅ **Mesin pipeline** — arsitektur modular Detector → Router → Compressor → Evaluator
- ✅ **Kompresi kode** — TypeScript (37%), Python (48%), Go (32%) penghematan melalui penghapusan komentar/spasi berbasis heuristik
- ✅ **6 lapisan kompresi** — dari aman (baris kosong, komentar inline) hingga agresif (ringkasan import, pelipatan pola berulang)
- ✅ **Hook ditingkatkan** — hook PostToolUse sekarang mengompresi kode sumber selain data terstruktur
- ✅ Desain yang dapat diperluas — tambahkan format baru dengan mengimplementasikan satu antarmuka `Compressor`
- ✅ Kompatibilitas mundur penuh — semua API eksternal tidak berubah
- ✅ 196 pengujian (sebelumnya 157), tinjauan kode komprehensif lulus

## Fitur

- **Pengurangan Token 25-66%** (biasanya ~48%) untuk data JSON, CSV, YAML
- **Kompresi Kode 20-48%** untuk kode sumber TypeScript, Python, Go
- **Arsitektur Pipeline** - Mesin yang dapat diperluas Detector → Compressor → Evaluator
- **Dukungan Multibahasa** - Penghitungan token akurat untuk 15+ bahasa
- **Sepenuhnya Otomatis** - Hook PostToolUse mencegat hasil tool
- **Tanpa Konfigurasi** - Bekerja langsung dengan nilai default yang masuk akal
- **Mode Ganda** - Bekerja sebagai plugin (otomatis) atau server MCP (manual)
- **Metrik Bawaan** - Melacak penghematan token secara lokal
- **Fallback Senyap** - Tidak pernah mengganggu alur kerja Anda

## Instalasi

### Opsi A: Unduh dari GitHub (Direkomendasikan) 🌟

**Instalasi langsung dari repositori GitHub (tanpa perlu npm publish):**

```bash
# 1. Unduh repositori
git clone https://github.com/PCIRCLE-AI/toonify-mcp.git
cd toonify-mcp

# 2. Instal dependensi dan build
npm install
npm run build

# 3. Instal global dari sumber lokal
npm install -g .
```

### Opsi B: Instal dari marketplace pcircle.ai (Termudah) 🌟

**Instalasi satu klik:**

Buka [marketplace pcircle.ai](https://claudemarketplaces.com) di Claude Code dan instal toonify-mcp dengan satu klik. Marketplace menangani semuanya secara otomatis!

### Opsi C: Plugin Claude Code (Direkomendasikan) ⭐

**Optimasi token otomatis tanpa panggilan manual:**

Prasyarat: selesaikan opsi A atau B agar biner `toonify-mcp` tersedia.

```bash
# 1. Tambahkan sebagai plugin (mode otomatis)
claude plugin add toonify-mcp

# 2. Verifikasi instalasi
claude plugin list
# Seharusnya menampilkan: toonify-mcp ✓
```

**Selesai!** Hook PostToolUse sekarang akan secara otomatis mencegat dan mengoptimalkan data terstruktur dari Read, Grep, dan tool file lainnya.

### Opsi D: Server MCP (mode manual)

**Untuk kontrol eksplisit atau klien MCP non-Claude Code:**

Prasyarat: selesaikan opsi A atau B agar biner `toonify-mcp` tersedia.

```bash
# 1. Daftarkan sebagai server MCP
claude mcp add toonify -- toonify-mcp

# 2. Verifikasi
claude mcp list
# Seharusnya menampilkan: toonify: toonify-mcp - ✓ Connected
```

Kemudian panggil tool secara eksplisit:
```bash
claude mcp call toonify optimize_content '{"content": "..."}'
claude mcp call toonify get_stats '{}'
```

## Cara Kerja

### Mode Plugin (otomatis)

```
Pengguna: Baca file JSON besar
  ↓
Claude Code memanggil tool Read
  ↓
Hook PostToolUse mencegat hasil
  ↓
Hook mendeteksi JSON, konversi ke TOON
  ↓
Konten yang dioptimalkan dikirim ke Claude API
  ↓
Pengurangan token 25-66% (biasanya ~48%) tercapai ✨
```

### Mode Server MCP (manual)

```
Pengguna: Panggil mcp__toonify__optimize_content secara eksplisit
  ↓
Konten dikonversi ke format TOON
  ↓
Mengembalikan hasil yang dioptimalkan
```

## Konfigurasi

Buat `~/.claude/toonify-config.json` (opsional):

```json
{
  "enabled": true,
  "minTokensThreshold": 50,
  "minSavingsThreshold": 30,
  "skipToolPatterns": ["Bash", "Write", "Edit"]
}
```

### Opsi

- **enabled**: Aktifkan/nonaktifkan optimasi otomatis (default: `true`)
- **minTokensThreshold**: Token minimum sebelum optimasi (default: `50`)
- **minSavingsThreshold**: Persentase penghematan minimum yang diperlukan (default: `30%`)
- **skipToolPatterns**: Tool yang tidak pernah dioptimalkan (default: `["Bash", "Write", "Edit"]`)

### Variabel Lingkungan

```bash
export TOONIFY_ENABLED=true
export TOONIFY_MIN_TOKENS=50
export TOONIFY_MIN_SAVINGS=30
export TOONIFY_SKIP_TOOLS="Bash,Write"
export TOONIFY_SHOW_STATS=true  # Tampilkan statistik optimasi dalam output
```

## Contoh

### Sebelum Optimasi (142 token)

```json
{
  "products": [
    {"id": 101, "name": "Laptop Pro", "price": 1299},
    {"id": 102, "name": "Magic Mouse", "price": 79}
  ]
}
```

### Setelah Optimasi (57 token, -60%)

```
[TOON-JSON]
products[2]{id,name,price}:
  101,Laptop Pro,1299
  102,Magic Mouse,79
```

**Diterapkan secara otomatis dalam mode plugin - tidak perlu panggilan manual!**

## Tips Penggunaan

### Kapan Optimasi Otomatis Dipicu?

Hook PostToolUse secara otomatis mengoptimalkan ketika:
- ✅ Konten adalah JSON, CSV, atau YAML yang valid
- ✅ Ukuran konten ≥ `minTokensThreshold` (default: 50 token)
- ✅ Perkiraan penghematan ≥ `minSavingsThreshold` (default: 30%)
- ✅ Tool TIDAK ada dalam `skipToolPatterns` (misalnya, bukan Bash/Write/Edit)

### Lihat Statistik Optimasi

```bash
# Dalam mode plugin
claude mcp call toonify get_stats '{}'

# Atau periksa output Claude Code untuk statistik (jika TOONIFY_SHOW_STATS=true)
```

## Pemecahan Masalah

### Hook Tidak Terpicu

```bash
# 1. Periksa plugin sudah diinstal
claude plugin list | grep toonify

# 2. Periksa konfigurasi
cat ~/.claude/toonify-config.json

# 3. Aktifkan statistik untuk melihat percobaan optimasi
export TOONIFY_SHOW_STATS=true
```

### Optimasi Tidak Diterapkan

- Periksa `minTokensThreshold` - konten mungkin terlalu kecil
- Periksa `minSavingsThreshold` - penghematan mungkin < 30%
- Periksa `skipToolPatterns` - tool mungkin ada dalam daftar lewati
- Verifikasi konten adalah JSON/CSV/YAML yang valid

### Masalah Kinerja

- Kurangi `minTokensThreshold` untuk mengoptimalkan lebih agresif
- Tingkatkan `minSavingsThreshold` untuk melewati optimasi marginal
- Tambahkan lebih banyak tool ke `skipToolPatterns` jika diperlukan

## Perbandingan: Plugin vs Server MCP

| Fitur | Mode Plugin | Mode Server MCP |
|-------|------------|----------------|
| **Aktivasi** | Otomatis (PostToolUse) | Manual (panggil tool) |
| **Kompatibilitas** | Hanya Claude Code | Klien MCP apa pun |
| **Konfigurasi** | File konfigurasi plugin | Tool MCP |
| **Kinerja** | Tanpa overhead | Overhead panggilan |
| **Use Case** | Alur kerja sehari-hari | Kontrol eksplisit |

**Rekomendasi**: Gunakan mode plugin untuk optimasi otomatis. Gunakan mode server MCP untuk kontrol eksplisit atau klien MCP lainnya.

## Uninstall

### Mode Plugin
```bash
claude plugin remove toonify-mcp
rm ~/.claude/toonify-config.json
```

### Mode Server MCP
```bash
claude mcp remove toonify
```

### Paket
```bash
npm uninstall -g toonify-mcp
```

## Tautan

- **GitHub**: https://github.com/PCIRCLE-AI/toonify-mcp
- **Issues**: https://github.com/PCIRCLE-AI/toonify-mcp/issues
- **GitHub**: https://github.com/PCIRCLE-AI/toonify-mcp
- **Dokumentasi MCP**: https://code.claude.com/docs/mcp
- **Format TOON**: https://github.com/toon-format/toon

## Kontribusi

Kontribusi sangat disambut! Silakan lihat [CONTRIBUTING.md](CONTRIBUTING.md) untuk panduan.

## Lisensi

Lisensi MIT - lihat [LICENSE](LICENSE)

---

## Catatan Perubahan

### v0.6.0 (2026-04-03)
- ✨ **Arsitektur pipeline** — mesin modular Detector → Router → Compressor → Evaluator
- ✨ **Kompresi kode** — kompresi berbasis heuristik untuk TypeScript (37%), Python (48%), Go (32%)
- ✨ **6 lapisan kompresi** — menggabungkan baris kosong, menghapus komentar inline/blok, mempersingkat import, meringkas import, melipat pola berulang
- ✨ **Jaminan keamanan** — tidak pernah menghapus logika kode, mempertahankan TODO/FIXME, mempertahankan ringkasan JSDoc/docstring
- ✨ **Hook ditingkatkan** — hook PostToolUse sekarang mendeteksi dan mengompresi kode sumber (Lapisan 1-4)
- ✨ **Dapat diperluas** — tambahkan tipe konten baru dengan mengimplementasikan antarmuka `Compressor` dan mendaftarkannya ke pipeline
- 🔧 TokenOptimizer direfaktor ke pola facade — semua API eksternal tidak berubah
- 📊 196 pengujian (sebelumnya 157), tinjauan kode komprehensif 16 dimensi lulus

### v0.5.0 (2026-01-21)
- ✨ **Pembaruan SDK dan tooling** - SDK MCP, tokenizer, dan YAML diperbarui
- ✨ Migrasi Jest 30 dengan transform ESM TypeScript berbasis SWC
- 🔒 Perbaikan keamanan via npm audit

### v0.3.0 (2025-12-26)
- ✨ **Optimasi token multibahasa** - penghitungan akurat untuk 15+ bahasa
- ✨ Pengali token sadar bahasa (2x Mandarin, 2.5x Jepang, 3x Arab, dll.)
- ✨ Deteksi dan optimasi teks campuran multibahasa
- ✨ Tes benchmark komprehensif dengan statistik nyata
- 📊 Klaim penghematan token yang didukung data (rentang 25-66%, biasanya ~48%)
- ✅ 75+ tes lulus, termasuk kasus edge multibahasa
- 📝 Versi README multibahasa

### v0.2.0 (2025-12-25)
- ✨ Menambahkan dukungan plugin Claude Code dengan hook PostToolUse
- ✨ Optimasi token otomatis (tidak perlu panggilan manual)
- ✨ Sistem konfigurasi plugin
- ✨ Mode ganda: Plugin (otomatis) + Server MCP (manual)
- 📝 Pembaruan dokumentasi komprehensif

### v0.1.1 (2024-12-24)
- 🐛 Perbaikan bug dan peningkatan
- 📝 Pembaruan dokumentasi

### v0.1.0 (2024-12-24)
- 🎉 Rilis awal
- ✨ Implementasi server MCP
- ✨ Optimasi format TOON
- ✨ Pelacakan metrik bawaan
