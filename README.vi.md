# Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Toonify MCP giúp Claude Code đỡ nặng hơn khi phiên làm việc bị kéo xuống bởi những đầu ra quá lớn.

## Người dùng được lợi gì

- JSON, CSV, YAML và phản hồi API nhẹ hơn
- Lỗi test dài và stack trace dễ đi qua cùng một phiên hơn
- Cách dùng Claude Code hằng ngày gần như không phải đổi

## Ai nên thử trước

- Người hay đọc tool output lớn
- Người thường đưa logs, traces hoặc file mã nguồn vào Claude Code
- Người muốn một cách làm local và tự động

## Khi lợi ích không nhiều

- Văn bản ngắn
- File rất nhỏ
- Nội dung mà định dạng gốc quan trọng hơn việc tiết kiệm context

## Cài nhanh

```bash
git clone https://github.com/PCIRCLE-AI/toonify-mcp.git
cd toonify-mcp
npm install
npm run build
npm install -g .
toonify-mcp setup
toonify-mcp doctor
```

`toonify-mcp setup` sẽ tự thêm marketplace local rồi xử lý luôn việc cài, cập nhật hoặc bật lại plugin.

## Kiểm tra nhanh

```bash
toonify-mcp status
```

## Chế độ MCP (tùy chọn)

```bash
toonify-mcp setup mcp
claude mcp list
```

## Xem bản mới nhất ở đâu

- Bản chính: [README.md](README.md)
- Bản tiếng Hoa phồn thể: [README.zh-TW.md](README.zh-TW.md)
- Website công khai: https://toonify.pcircle.ai/
