# 🎯 Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Máy chủ MCP + Plugin Claude Code cung cấp tối ưu hóa token tự động cho dữ liệu có cấu trúc **và mã nguồn**.
Giảm **25-66%** token cho JSON/CSV/YAML và **20-48%** cho mã nguồn TypeScript/Python/Go thông qua kiến trúc pipeline.

## Có gì mới trong v0.6.0

✨ **Kiến trúc pipeline + nén mã nguồn!**
- ✅ **Động cơ pipeline** — kiến trúc module hóa Detector → Router → Compressor → Evaluator
- ✅ **Nén mã nguồn** — TypeScript (37%), Python (48%), Go (32%) tiết kiệm thông qua loại bỏ comment/khoảng trắng dựa trên heuristic
- ✅ **6 lớp nén** — từ an toàn (dòng trống, comment inline) đến tích cực (tóm tắt import, thu gọn mẫu lặp lại)
- ✅ **Hook nâng cấp** — Hook PostToolUse giờ đây nén cả mã nguồn ngoài dữ liệu có cấu trúc
- ✅ Thiết kế mở rộng — thêm định dạng mới bằng cách triển khai giao diện `Compressor` duy nhất
- ✅ Hoàn toàn tương thích ngược — tất cả API bên ngoài không thay đổi
- ✅ 196 bài kiểm tra (trước đó 157), đánh giá mã nguồn toàn diện đã vượt qua

## Tính năng

- **Giảm 25-66% token** (thường ~48%) cho dữ liệu JSON, CSV, YAML
- **Nén mã nguồn 20-48%** cho mã nguồn TypeScript, Python, Go
- **Kiến trúc pipeline** - Động cơ mở rộng Detector → Compressor → Evaluator
- **Hỗ trợ đa ngôn ngữ** - Đếm token chính xác cho hơn 15 ngôn ngữ
- **Hoàn toàn tự động** - Hook PostToolUse chặn kết quả công cụ
- **Không cần cấu hình** - Hoạt động ngay lập tức với các giá trị mặc định hợp lý
- **Chế độ kép** - Hoạt động như plugin (tự động) hoặc máy chủ MCP (thủ công)
- **Chỉ số tích hợp** - Theo dõi tiết kiệm token cục bộ
- **Dự phòng im lặng** - Không bao giờ làm gián đoạn quy trình làm việc của bạn

## Cài đặt

### Tùy chọn A: Tải từ GitHub (Khuyến nghị) 🌟

**Cài đặt trực tiếp từ kho GitHub (không cần publish npm):**

```bash
# 1. Tải kho về
git clone https://github.com/PCIRCLE-AI/toonify-mcp.git
cd toonify-mcp

# 2. Cài phụ thuộc và build
npm install
npm run build

# 3. Cài đặt toàn cục từ nguồn cục bộ
npm install -g .
```

### Tùy chọn B: Cài đặt từ marketplace pcircle.ai (Dễ nhất) 🌟

**Cài đặt một cú nhấp:**

Duyệt đến [marketplace pcircle.ai](https://claudemarketplaces.com) trong Claude Code và cài đặt toonify-mcp chỉ với một cú nhấp. Marketplace xử lý mọi thứ tự động!

### Tùy chọn C: Plugin Claude Code (Khuyến nghị) ⭐

**Tối ưu hóa token tự động không cần gọi thủ công:**

Yêu cầu: hoàn tất tùy chọn A hoặc B để có sẵn binary `toonify-mcp`.

```bash
# 1. Thêm làm plugin (chế độ tự động)
claude plugin add toonify-mcp

# 2. Xác minh cài đặt
claude plugin list
# Nên hiển thị: toonify-mcp ✓
```

**Xong! ** Hook PostToolUse bây giờ sẽ tự động chặn và tối ưu hóa dữ liệu có cấu trúc từ Read, Grep và các công cụ tệp khác.

### Tùy chọn D: Máy chủ MCP (chế độ thủ công)

**Cho kiểm soát rõ ràng hoặc các máy khách MCP không phải Claude Code:**

Yêu cầu: hoàn tất tùy chọn A hoặc B để có sẵn binary `toonify-mcp`.

```bash
# 1. Đăng ký làm máy chủ MCP
claude mcp add toonify -- toonify-mcp

# 2. Xác minh
claude mcp list
# Nên hiển thị: toonify: toonify-mcp - ✓ Connected
```

Sau đó gọi các công cụ rõ ràng:
```bash
claude mcp call toonify optimize_content '{"content": "..."}'
claude mcp call toonify get_stats '{}'
```

## Cách hoạt động

### Chế độ plugin (tự động)

```
Người dùng: Đọc tệp JSON lớn
  ↓
Claude Code gọi công cụ Read
  ↓
Hook PostToolUse chặn kết quả
  ↓
Hook phát hiện JSON, chuyển đổi sang TOON
  ↓
Nội dung đã tối ưu hóa được gửi đến Claude API
  ↓
Đạt được mức giảm token điển hình ~48% ✨
```

### Chế độ máy chủ MCP (thủ công)

```
Người dùng: Gọi rõ ràng mcp__toonify__optimize_content
  ↓
Nội dung được chuyển đổi sang định dạng TOON
  ↓
Trả về kết quả đã tối ưu hóa
```

## Cấu hình

Tạo `~/.claude/toonify-config.json` (tùy chọn):

```json
{
  "enabled": true,
  "minTokensThreshold": 50,
  "minSavingsThreshold": 30,
  "skipToolPatterns": ["Bash", "Write", "Edit"]
}
```

### Tùy chọn

- **enabled**: Bật/tắt tối ưu hóa tự động (mặc định: `true`)
- **minTokensThreshold**: Token tối thiểu trước khi tối ưu hóa (mặc định: `50`)
- **minSavingsThreshold**: Phần trăm tiết kiệm tối thiểu yêu cầu (mặc định: `30%`)
- **skipToolPatterns**: Công cụ không bao giờ tối ưu hóa (mặc định: `["Bash", "Write", "Edit"]`)

### Biến môi trường

```bash
export TOONIFY_ENABLED=true
export TOONIFY_MIN_TOKENS=50
export TOONIFY_MIN_SAVINGS=30
export TOONIFY_SKIP_TOOLS="Bash,Write"
export TOONIFY_SHOW_STATS=true  # Hiển thị thống kê tối ưu hóa trong đầu ra
```

## Ví dụ

### Trước khi tối ưu hóa (142 token)

```json
{
  "products": [
    {"id": 101, "name": "Laptop Pro", "price": 1299},
    {"id": 102, "name": "Magic Mouse", "price": 79}
  ]
}
```

### Sau khi tối ưu hóa (57 token, -60%)

```
[TOON-JSON]
products[2]{id,name,price}:
  101,Laptop Pro,1299
  102,Magic Mouse,79
```

**Tự động áp dụng ở chế độ plugin - không cần gọi thủ công!**

## Mẹo sử dụng

### Khi nào tối ưu hóa tự động được kích hoạt?

Hook PostToolUse tự động tối ưu hóa khi:
- ✅ Nội dung là JSON, CSV hoặc YAML hợp lệ
- ✅ Kích thước nội dung ≥ `minTokensThreshold` (mặc định: 50 token)
- ✅ Tiết kiệm ước tính ≥ `minSavingsThreshold` (mặc định: 30%)
- ✅ Công cụ KHÔNG có trong `skipToolPatterns` (ví dụ: không phải Bash/Write/Edit)

### Xem thống kê tối ưu hóa

```bash
# Ở chế độ plugin
claude mcp call toonify get_stats '{}'

# Hoặc kiểm tra đầu ra Claude Code để xem thống kê (nếu TOONIFY_SHOW_STATS=true)
```

## Khắc phục sự cố

### Hook không kích hoạt

```bash
# 1. Kiểm tra plugin đã được cài đặt
claude plugin list | grep toonify

# 2. Kiểm tra cấu hình
cat ~/.claude/toonify-config.json

# 3. Bật thống kê để xem các lần thử tối ưu hóa
export TOONIFY_SHOW_STATS=true
```

### Tối ưu hóa không được áp dụng

- Kiểm tra `minTokensThreshold` - nội dung có thể quá nhỏ
- Kiểm tra `minSavingsThreshold` - tiết kiệm có thể < 30%
- Kiểm tra `skipToolPatterns` - công cụ có thể nằm trong danh sách bỏ qua
- Xác minh nội dung là JSON/CSV/YAML hợp lệ

### Vấn đề hiệu suất

- Giảm `minTokensThreshold` để tối ưu hóa tích cực hơn
- Tăng `minSavingsThreshold` để bỏ qua các tối ưu hóa biên
- Thêm nhiều công cụ hơn vào `skipToolPatterns` nếu cần

## So sánh: Plugin vs Máy chủ MCP

| Tính năng | Chế độ Plugin | Chế độ Máy chủ MCP |
|-----------|--------------|-------------------|
| **Kích hoạt** | Tự động (PostToolUse) | Thủ công (gọi công cụ) |
| **Tương thích** | Chỉ Claude Code | Bất kỳ máy khách MCP nào |
| **Cấu hình** | Tệp cấu hình plugin | Công cụ MCP |
| **Hiệu suất** | Không có chi phí | Chi phí gọi |
| **Trường hợp sử dụng** | Quy trình làm việc hàng ngày | Kiểm soát rõ ràng |

**Khuyến nghị**: Sử dụng chế độ plugin cho tối ưu hóa tự động. Sử dụng chế độ máy chủ MCP cho kiểm soát rõ ràng hoặc các máy khách MCP khác.

## Gỡ cài đặt

### Chế độ plugin
```bash
claude plugin remove toonify-mcp
rm ~/.claude/toonify-config.json
```

### Chế độ máy chủ MCP
```bash
claude mcp remove toonify
```

### Gói
```bash
npm uninstall -g toonify-mcp
```

## Liên kết

- **GitHub**: https://github.com/PCIRCLE-AI/toonify-mcp
- **Issues**: https://github.com/PCIRCLE-AI/toonify-mcp/issues
- **GitHub**: https://github.com/PCIRCLE-AI/toonify-mcp
- **Tài liệu MCP**: https://code.claude.com/docs/mcp
- **Định dạng TOON**: https://github.com/toon-format/toon

## Đóng góp

Đóng góp được chào đón! Vui lòng xem [CONTRIBUTING.md](CONTRIBUTING.md) để biết hướng dẫn.

## Giấy phép

Giấy phép MIT - xem [LICENSE](LICENSE)

---

## Nhật ký thay đổi

### v0.6.0 (2026-04-03)
- ✨ **Kiến trúc pipeline** — động cơ module hóa Detector → Router → Compressor → Evaluator
- ✨ **Nén mã nguồn** — nén dựa trên heuristic cho TypeScript (37%), Python (48%), Go (32%)
- ✨ **6 lớp nén** — gộp dòng trống, xóa comment inline/block, rút gọn import, tóm tắt import, thu gọn mẫu lặp lại
- ✨ **Đảm bảo an toàn** — không bao giờ xóa logic mã, giữ lại TODO/FIXME, giữ lại tóm tắt JSDoc/docstring
- ✨ **Hook nâng cấp** — hook PostToolUse giờ phát hiện và nén mã nguồn (Lớp 1-4)
- ✨ **Mở rộng** — thêm loại nội dung mới bằng cách triển khai giao diện `Compressor` và đăng ký với pipeline
- 🔧 TokenOptimizer tái cấu trúc sang mẫu facade — tất cả API bên ngoài không thay đổi
- 📊 196 bài kiểm tra (trước đó 157), đánh giá mã nguồn toàn diện 16 chiều đã vượt qua

### v0.5.0 (2026-01-21)
- ✨ **Cập nhật SDK và tooling** - MCP SDK, tokenizer và YAML được cập nhật
- ✨ Di chuyển sang Jest 30 với chuyển đổi TypeScript ESM dựa trên SWC
- 🔒 Áp dụng bản vá bảo mật qua npm audit

### v0.3.0 (2025-12-26)
- ✨ **Tối ưu hóa token đa ngôn ngữ** - đếm chính xác cho hơn 15 ngôn ngữ
- ✨ Hệ số nhân token nhận biết ngôn ngữ (2x Trung, 2.5x Nhật, 3x Ả Rập, v.v.)
- ✨ Phát hiện và tối ưu hóa văn bản hỗn hợp nhiều ngôn ngữ
- ✨ Kiểm tra chuẩn toàn diện với thống kê thực tế
- 📊 Tuyên bố tiết kiệm token được hỗ trợ bởi dữ liệu (phạm vi 25-66%, thường ~48%)
- ✅ Hơn 75 kiểm tra đã vượt qua, bao gồm các trường hợp biên đa ngôn ngữ
- 📝 Các phiên bản README đa ngôn ngữ

### v0.2.0 (2025-12-25)
- ✨ Đã thêm hỗ trợ plugin Claude Code với hook PostToolUse
- ✨ Tối ưu hóa token tự động (không cần gọi thủ công)
- ✨ Hệ thống cấu hình plugin
- ✨ Chế độ kép: Plugin (tự động) + Máy chủ MCP (thủ công)
- 📝 Cập nhật tài liệu toàn diện

### v0.1.1 (2024-12-24)
- 🐛 Sửa lỗi và cải tiến
- 📝 Cập nhật tài liệu

### v0.1.0 (2024-12-24)
- 🎉 Phát hành ban đầu
- ✨ Triển khai máy chủ MCP
- ✨ Tối ưu hóa định dạng TOON
- ✨ Theo dõi chỉ số tích hợp
