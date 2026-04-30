# Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Toonify MCP membantu saat Claude Code terasa berat karena output yang terlalu besar.

## Manfaat yang langsung terasa

- JSON, CSV, YAML, dan respons API jadi lebih ringan
- Kegagalan test yang panjang dan stack trace lebih mudah dibawa dalam satu sesi
- Cara kerja Claude Code sehari-hari tidak perlu diubah

## Siapa yang paling cocok mencoba

- Orang yang sering membaca tool output besar
- Orang yang sering memasukkan logs, traces, atau file source code ke Claude Code
- Orang yang ingin solusi lokal dan otomatis

## Kapan manfaatnya kecil

- Teks pendek
- File yang sangat kecil
- Konten yang lebih mementingkan format asli

## Instalasi cepat

```bash
git clone https://github.com/PCIRCLE-AI/toonify-mcp.git
cd toonify-mcp
npm install
npm run build
npm install -g .
toonify-mcp setup
toonify-mcp doctor
```

`toonify-mcp setup` akan menambahkan marketplace lokal lalu menangani install, update, atau enable plugin secara otomatis.

## Cek cepat

```bash
toonify-mcp status
```

## Mode MCP (opsional)

```bash
toonify-mcp setup mcp
claude mcp list
```

## Tempat melihat versi terbaru

- Panduan utama: [README.md](README.md)
- Versi Mandarin tradisional: [README.zh-TW.md](README.zh-TW.md)
- Situs publik: https://toonify.pcircle.ai/
