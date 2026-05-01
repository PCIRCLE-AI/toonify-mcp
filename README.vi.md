# Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Plugin nén ngữ cảnh cho Claude Code. Tự động thu gọn đầu ra lớn từ công cụ—JSON, CSV, YAML, stack trace và log—trước khi chúng vào cửa sổ ngữ cảnh.

Hoạt động như plugin Claude Code (tự động, không cần cấu hình) hoặc máy chủ MCP (theo yêu cầu).

## Tính năng

- Nén phản hồi lớn dạng JSON, CSV, YAML và API
- Thu gọn test failure dài và stack trace
- Chạy tự động nền—không thay đổi quy trình làm việc Claude Code

## Giới hạn

Bỏ qua với văn bản ngắn, file rất nhỏ, và nội dung cần giữ nguyên định dạng gốc.

## Cài đặt

```bash
git clone https://github.com/PCIRCLE-AI/toonify-mcp.git
cd toonify-mcp
npm install
npm run build
npm install -g .
toonify-mcp setup
toonify-mcp doctor
```

`toonify-mcp setup` thêm marketplace local và tự động cài đặt, cập nhật hoặc bật lại plugin.

## Kiểm tra trạng thái

```bash
toonify-mcp status
```

## Chế độ MCP (tùy chọn)

```bash
toonify-mcp setup mcp
claude mcp list
```

`claude mcp list` phải hiển thị `toonify: toonify-mcp - ✓ Connected`.

## Tài liệu

- Website: https://toonify.pcircle.ai/
- Benchmarks: https://toonify.pcircle.ai/benchmarks.html
- Quyền riêng tư: https://toonify.pcircle.ai/privacy.html
- Điều khoản: https://toonify.pcircle.ai/terms.html
- [CHANGELOG.md](CHANGELOG.md)
