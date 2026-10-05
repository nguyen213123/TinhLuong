# Quản lý lương theo sản phẩm

Ứng dụng desktop cho Windows. Giao diện tiếng Việt; dữ liệu được đọc và ghi bằng workbook Excel, không dùng cơ sở dữ liệu.

## Chạy trong VS Code

1. Cài Node.js LTS và VS Code trên Windows.
2. Mở thư mục này bằng VS Code.
3. Mở Terminal và chạy `npm install` để cài Electron và thư viện xử lý Excel.
4. Chạy `npm start` để mở ứng dụng.

Chạy bộ kiểm tra nghiệp vụ với `npm test`.

Nếu giao diện không phản hồi, nhấn `F12` để mở DevTools. Lỗi JavaScript sẽ được ghi ra Terminal chạy `npm start`; gửi dòng lỗi màu đỏ để khoanh vùng lỗi trên máy đó.

Để tạo bản portable trên Windows, chạy `npm run dist`. File cài đặt sẽ được tạo trong thư mục `dist`.

## Dữ liệu

Workbook chính được lưu tại `%USERPROFILE%\Documents\QuanLyLuong\DuLieuLuong.xlsx`. Workbook có các sheet `Workers`, `Products`, `Production`, `Debts`, `Payments`, `Periods` và `Audit`. Dùng nút **Mở thư mục dữ liệu** trong sidebar để mở thư mục này.

Khi thanh toán, ứng dụng khóa sản lượng và đợt, đồng thời xuất file Excel riêng vào `Documents\QuanLyLuong\Luong\<Tên công nhân>\Dot-DD-MM-YYYY_DD-MM-YYYY.xlsx`. File đợt có các sheet `Production`, `Payment`, `Debt` và `Summary`. Bảng thanh toán ghi riêng tổng lương sản phẩm, nợ Kỹ sư đã trừ, nợ Công ty cộng thêm và tiền thực nhận; sheet `Debt` liệt kê các khoản đã tất toán trong giao dịch đó.

Đơn giá được lưu trực tiếp trên mỗi dòng sản lượng. Sửa giá sản phẩm chỉ ảnh hưởng lần nhập sau. Số lượng theo cùng công nhân và ngày được gộp theo sản phẩm; nhập trùng ngày sẽ yêu cầu chọn cộng thêm hoặc thay thế. Thanh toán luôn trả toàn bộ lương chưa trả và chỉ trừ khoản nợ được quản lý chọn.

## Giới hạn hiện tại

- Cần kết nối mạng lần đầu để `npm install` tải các gói khai báo trong `package.json`.
- Chưa có bộ tự nâng cấp ứng dụng.
- Excel chính là nguồn dữ liệu; không mở workbook chính bằng Excel trong lúc ứng dụng đang ghi dữ liệu.


