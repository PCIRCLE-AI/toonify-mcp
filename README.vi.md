# Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Plugin nén ngữ cảnh cho Claude Code. Tự động thu gọn đầu ra lớn từ công cụ—JSON, YAML, stack trace và log—trước khi chúng vào cửa sổ ngữ cảnh.

Hoạt động như plugin Claude Code (tự động, không cần cấu hình) hoặc máy chủ MCP (theo yêu cầu).

## Tính năng

- Nén phản hồi lớn dạng JSON, YAML và API
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

## Bộ lọc pipe (mọi agent CLI)

`toonify-mcp compress` đọc từ stdin, nén những gì có thể nén an toàn (JSON/YAML → TOON, log lặp lại được gộp gọn; mã nguồn, văn bản thường và các con số cần độ chính xác cao được giữ nguyên), rồi ghi ra stdout. Nó không bao giờ làm hỏng pipe—khi không thể nén, đầu vào được xuất ra nguyên vẹn từng byte.

```bash
curl -s https://api.example.com/users | toonify-mcp compress
```

Cách này hoạt động với mọi agent CLI, vì đầu ra được nén *trước khi* vào ngữ cảnh của mô hình. Để agent tự dùng nó, hãy thêm một quy tắc vào file hướng dẫn agent của dự án (ví dụ `AGENTS.md`):

```markdown
When a command is likely to print large JSON/YAML or long logs,
pipe it through `toonify-mcp compress` (e.g. `curl ... | toonify-mcp compress`).
It only rewrites output it can compress losslessly; everything else passes through.
```

## OpenAI Codex CLI (theo yêu cầu)

```bash
toonify-mcp setup codex
```

Đăng ký toonify làm máy chủ MCP trong `~/.codex/config.toml` (file này được sao lưu kèm dấu thời gian trước khi sửa). Sau đó Codex có thể gọi công cụ `optimize_content` khi cần.

Lưu ý: trên Codex, tính năng này là **theo yêu cầu, không tự động**—hook của Codex hiện chưa thể thay thế đầu ra công cụ như `updatedToolOutput` của Claude Code, và việc nối thêm bản nén sẽ làm ngữ cảnh phình to thay vì thu nhỏ. Để nén tự động trên Codex, hãy dùng bộ lọc pipe ở trên.

## Tài liệu

- Website: https://toonify.pcircle.ai/
- Benchmarks: https://toonify.pcircle.ai/benchmarks.html
- Quyền riêng tư: https://toonify.pcircle.ai/privacy.html
- Điều khoản: https://toonify.pcircle.ai/terms.html
- [CHANGELOG.md](CHANGELOG.md)
