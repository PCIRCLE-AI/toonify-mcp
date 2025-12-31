# 🎯 Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Máy chủ MCP + Plugin Claude Code cung cấp tối ưu hóa token tự động cho dữ liệu có cấu trúc.
Giảm 30-65% việc sử dụng token của Claude API **tùy thuộc vào cấu trúc dữ liệu** thông qua chuyển đổi định dạng TOON minh bạch, với mức tiết kiệm điển hình **50-55%** cho dữ liệu có cấu trúc.

## Có gì mới trong v0.4.0

✨ **Hệ thống bộ nhớ cache cải tiến!**
- ✅ Bộ nhớ cache LRU với hết hạn TTL và lưu trữ đĩa tùy chọn
- ✅ Cải thiện hiệu suất 50-500 lần khi trúng cache (~0,1ms so với 5-50ms)
- ✅ Ba công cụ MCP mới: `clear_cache`, `get_cache_stats`, `cleanup_expired_cache`
- ✅ Tự động lưu cache kết quả tối ưu hóa - tránh xử lý lại nội dung giống hệt
- ✅ Sửa lỗi nghiêm trọng: điều kiện tranh chấp, I/O đĩa quá mức, vấn đề hiệu suất O(n)
- ✅ Tất cả 122 bài kiểm tra đã qua (trước đây là 105) - đã sửa 5 lỗi kiểm tra hiệu suất

## Tính năng

- **Giảm 30-65% token** (thường 50-55%) cho dữ liệu JSON, CSV, YAML
- **Hỗ trợ đa ngôn ngữ** - Đếm token chính xác cho hơn 15 ngôn ngữ
- **Hoàn toàn tự động** - Hook PostToolUse chặn kết quả công cụ
- **Không cần cấu hình** - Hoạt động ngay lập tức với các giá trị mặc định hợp lý
- **Chế độ kép** - Hoạt động như plugin (tự động) hoặc máy chủ MCP (thủ công)
- **Chỉ số tích hợp** - Theo dõi tiết kiệm token cục bộ
- **Dự phòng im lặng** - Không bao giờ làm gián đoạn quy trình làm việc của bạn

## Cài đặt

### Tùy chọn A: Cài đặt từ marketplace pcircle.ai (Dễ nhất) 🌟

**Cài đặt một cú nhấp:**

Duyệt đến [marketplace pcircle.ai](https://claudemarketplaces.com) trong Claude Code và cài đặt toonify-mcp chỉ với một cú nhấp. Marketplace xử lý mọi thứ tự động!

### Tùy chọn B: Plugin Claude Code (Khuyến nghị) ⭐

**Tối ưu hóa token tự động không cần gọi thủ công:**

```bash
# 1. Cài đặt toàn cục
npm install -g toonify-mcp

# 2. Thêm làm plugin (chế độ tự động)
claude plugin add toonify-mcp

# 3. Xác minh cài đặt
claude plugin list
# Nên hiển thị: toonify-mcp ✓
```

**Xong! ** Hook PostToolUse bây giờ sẽ tự động chặn và tối ưu hóa dữ liệu có cấu trúc từ Read, Grep và các công cụ tệp khác.

### Tùy chọn B: Máy chủ MCP (chế độ thủ công)

**Cho kiểm soát rõ ràng hoặc các máy khách MCP không phải Claude Code:**

```bash
# 1. Cài đặt toàn cục
npm install -g toonify-mcp

# 2. Đăng ký làm máy chủ MCP
claude mcp add toonify -- toonify-mcp

# 3. Xác minh
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
Đạt được mức giảm token điển hình 50-55% ✨
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

- **GitHub**: https://github.com/kevintseng/toonify-mcp
- **Issues**: https://github.com/kevintseng/toonify-mcp/issues
- **NPM**: https://www.npmjs.com/package/toonify-mcp
- **Tài liệu MCP**: https://code.claude.com/docs/mcp
- **Định dạng TOON**: https://github.com/toon-format/toon

## Đóng góp

Đóng góp được chào đón! Vui lòng xem [CONTRIBUTING.md](CONTRIBUTING.md) để biết hướng dẫn.

## Giấy phép

Giấy phép MIT - xem [LICENSE](LICENSE)

---

🇹🇼 **Crafted in Taiwan** | 台灣製造
_Where innovation meets tradition_

## Nhật ký thay đổi

### v0.4.0 (2025-12-26)
- ✨ **Hệ thống cache cải tiến** - Cache LRU với hết hạn TTL và lưu trữ tùy chọn
- ✨ Cải thiện hiệu suất 50-500 lần khi trúng cache (~0,1ms so với 5-50ms)
- ✨ Ba công cụ MCP mới cho quản lý cache
- 🐛 Sửa lỗi nghiêm trọng: điều kiện tranh chấp, I/O đĩa quá mức, hiệu suất O(n)
- 🐛 Sửa lỗi trúng cache sai, thiếu xác thực, lỗi chưa xử lý
- ✅ Tất cả 122 bài kiểm tra đã qua (đã sửa 5 lỗi kiểm tra hiệu suất)

### v0.3.0 (2025-12-26)
- ✨ **Tối ưu hóa token đa ngôn ngữ** - đếm chính xác cho hơn 15 ngôn ngữ
- ✨ Hệ số nhân token nhận biết ngôn ngữ (2x Trung, 2.5x Nhật, 3x Ả Rập, v.v.)
- ✨ Phát hiện và tối ưu hóa văn bản hỗn hợp nhiều ngôn ngữ
- ✨ Kiểm tra chuẩn toàn diện với thống kê thực tế
- 📊 Tuyên bố tiết kiệm token được hỗ trợ bởi dữ liệu (phạm vi 30-65%, thường 50-55%)
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
