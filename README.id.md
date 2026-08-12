# Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Plugin kompresi konteks untuk Claude Code. Secara otomatis mengecilkan output alat yang besar—JSON, YAML, stack trace, dan log—sebelum masuk ke jendela konteks.

Berfungsi sebagai plugin Claude Code (otomatis, tanpa konfigurasi) atau server MCP (sesuai permintaan).

## Fitur

- Mengompresi respons JSON, YAML, dan API yang besar
- Memperkecil test failure panjang dan stack trace
- Berjalan otomatis di latar belakang—tidak ada perubahan pada alur kerja Claude Code

## Batasan

Dilewati untuk teks pendek, file sangat kecil, dan konten yang memerlukan format asli yang tepat.

## Instalasi

```bash
git clone https://github.com/PCIRCLE-AI/toonify-mcp.git
cd toonify-mcp
npm install
npm run build
npm install -g .
toonify-mcp setup
toonify-mcp doctor
```

`toonify-mcp setup` menambahkan marketplace lokal dan menginstal, memperbarui, atau mengaktifkan kembali plugin secara otomatis.

## Cek status

```bash
toonify-mcp status
```

## Mode MCP (opsional)

```bash
toonify-mcp setup mcp
claude mcp list
```

`claude mcp list` harus menampilkan `toonify: toonify-mcp - ✓ Connected`.

## Filter pipe (semua CLI agen)

`toonify-mcp compress` membaca stdin, mengompresi bagian yang aman dikompresi (JSON/YAML → TOON, log berulang diringkas; kode sumber, teks biasa, dan angka yang sensitif terhadap presisi dilewatkan tanpa perubahan), lalu menulis ke stdout. Ia tidak pernah merusak pipe—jika kompresi tidak berlaku, input keluar persis byte demi byte.

```bash
curl -s https://api.example.com/users | toonify-mcp compress
```

Ini berfungsi dengan CLI agen apa pun, karena output dikompresi *sebelum* masuk ke konteks model. Agar sebuah agen memakainya, tambahkan aturan ke instruksi agen proyek Anda (misalnya `AGENTS.md`):

```markdown
When a command is likely to print large JSON/YAML or long logs,
pipe it through `toonify-mcp compress` (e.g. `curl ... | toonify-mcp compress`).
It only rewrites output it can compress losslessly; everything else passes through.
```

## OpenAI Codex CLI (sesuai permintaan)

```bash
toonify-mcp setup codex
```

Mendaftarkan toonify sebagai server MCP di `~/.codex/config.toml` (cadangan file dengan stempel waktu dibuat terlebih dahulu). Codex kemudian dapat memanggil alat `optimize_content` sesuai kebutuhan.

Catatan: di Codex ini **sesuai permintaan, bukan otomatis**—hook Codex belum bisa mengganti output alat seperti yang dilakukan `updatedToolOutput` di Claude Code, dan menambahkan salinan terkompresi justru akan memperbesar konteks, bukan memperkecilnya. Untuk kompresi otomatis di Codex, gunakan filter pipe di atas.

## Dokumentasi

- Situs: https://toonify.pcircle.ai/
- Benchmark: https://toonify.pcircle.ai/benchmarks.html
- Privasi: https://toonify.pcircle.ai/privacy.html
- Ketentuan: https://toonify.pcircle.ai/terms.html
- [CHANGELOG.md](CHANGELOG.md)
