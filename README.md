# giaiphap

Trang giới thiệu các web đã làm của **GP · Giải Pháp**, chạy trên Firebase Hosting + Firestore.

- `/` – trang chủ: danh sách dự án đang bật hiển thị, lọc theo thẻ, phần liên hệ + form gửi lời nhắn.
- `/admin` – trang quản trị: đăng nhập Google, thêm/sửa/xoá dự án, bật/tắt hiển thị, sắp thứ tự, sửa nội dung trang chủ & thông tin liên hệ, đọc tin nhắn.

Không cần build: HTML/CSS/JS thuần, Firebase SDK v10 tải qua CDN.

## Cấu trúc

```
public/
  index.html        trang chủ
  admin.html        trang quản trị
  css/style.css
  js/firebase.js    cấu hình Firebase + ADMIN_EMAILS
  js/main.js        logic trang chủ
  js/admin.js       logic trang quản trị
  assets/logo.svg   logo GP (dùng luôn làm favicon)
firestore.rules     phân quyền dữ liệu
firebase.json       cấu hình hosting
```

## Dữ liệu Firestore

| Collection | Nội dung | Ai đọc / ghi |
|---|---|---|
| `sites` | `title, url, description, image, tags[], visible, featured, order` | Khách đọc web có `visible == true`; admin toàn quyền |
| `settings/site` | tiêu đề trang chủ + `contact { email, phone, zalo, facebook, github, address }` | Ai cũng đọc; admin ghi |
| `messages` | lời nhắn từ form liên hệ | Khách chỉ tạo mới; admin đọc/xoá |

## Cài đặt lần đầu (Firebase Console – project `giaiphap-ba3e2`)

1. **Authentication → Sign-in method** → bật **Google**.
2. **Authentication → Settings → Authorized domains**: đã có sẵn `giaiphap-ba3e2.web.app` và `firebaseapp.com`; thêm tên miền riêng nếu có.
3. **Firestore Database** → *Create database* (chế độ production, region `asia-southeast1`).
4. Sửa email quản trị ở **2 chỗ** cho giống nhau:
   - `public/js/firebase.js` → `ADMIN_EMAILS`
   - `firestore.rules` → hàm `isAdmin()`

## Deploy tự động (GitHub Actions)

Mỗi lần push lên `main`, workflow `.github/workflows/deploy.yml` sẽ deploy Hosting + Firestore rules. Cài một lần:

1. Firebase Console → ⚙️ Project settings → **Service accounts** → *Generate new private key* → tải file JSON.
2. GitHub repo → **Settings → Secrets and variables → Actions** → *New repository secret*:
   tên `FIREBASE_SERVICE_ACCOUNT`, giá trị = toàn bộ nội dung file JSON. Xoá file JSON khỏi máy sau khi dán.
3. Tab **Actions** → *Deploy Firebase* → *Run workflow* (hoặc push bất kỳ thay đổi nào).

## Deploy bằng tay

```bash
npm install -g firebase-tools
firebase login
firebase deploy            # deploy cả hosting + firestore rules
```

Chạy thử ở máy: `firebase serve` hoặc `firebase emulators:start --only hosting` rồi mở http://localhost:5000.

Sau khi deploy, vào `/admin`, đăng nhập Google, thêm dự án đầu tiên (ví dụ `https://botzlmanager.vercel.app/`) và điền thông tin liên hệ ở tab **Cài đặt & liên hệ**.
