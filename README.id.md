# Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Plugin kompresi konteks untuk Claude Code. Secara otomatis mengecilkan output alat yang besar—JSON, CSV, YAML, stack trace, dan log—sebelum masuk ke jendela konteks.

Berfungsi sebagai plugin Claude Code (otomatis, tanpa konfigurasi) atau server MCP (sesuai permintaan).

## Fitur

- Mengompresi respons JSON, CSV, YAML, dan API yang besar
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

## Dokumentasi

- Situs: https://toonify.pcircle.ai/
- Benchmark: https://toonify.pcircle.ai/benchmarks.html
- Privasi: https://toonify.pcircle.ai/privacy.html
- Ketentuan: https://toonify.pcircle.ai/terms.html
- [CHANGELOG.md](CHANGELOG.md)
