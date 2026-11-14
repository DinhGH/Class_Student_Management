# Hướng Dẫn Triển Khai & Demo Hệ Thống (Docker + Nginx Load Balancer + PostgreSQL Replication + Redis)

## 1. Kiến trúc hệ thống

- **Nginx Load Balancer (`nginx-lb`, cổng `80`)**:
  - Điều hướng `/` -> container `client` (React + Vite build).
  - Điều hướng `/api/` -> cụm 3 backend (`server-1`, `server-2`, `server-3`) theo thuật toán **Round Robin**, kèm failover tự động khi có node gặp sự cố.
- **3 Backend App Servers (`server-1`, `server-2`, `server-3`)**:
  - Chạy Express + Prisma, gắn header `X-Served-By: Backend Server 1|2|3` trên mọi response và trả về `serverName` tại `/api/health`, `/api/server-info`.
  - Tự động chạy `npx prisma db push` khi khởi động container.
- **Redis (`redis`)**:
  - Lưu trữ Full-Page Cache dùng chung (`/api/stats`) giúp cả 3 backend đồng bộ cache và invalidate đồng thời khi dữ liệu thay đổi.
- **PostgreSQL Master-Slave Streaming Replication (`db-master` & `db-slave`)**:
  - `db-master`: Database chính (đọc/ghi).
  - `db-slave`: Database backup (`hot_standby=on`), tự động clone qua `pg_basebackup` và đồng bộ dữ liệu theo thời gian thực từ `db-master`.

---

## 2. Khởi chạy hệ thống

Tại thư mục gốc `HomeWork/`:

```bash
docker compose up -d --build
```

Kiểm tra trạng thái các container:

```bash
docker compose ps
```

Truy cập ứng dụng trên trình duyệt:
- **Frontend**: `http://localhost`
- **Health check API**: `http://localhost/api/health`

*(Lưu ý: Nếu muốn reset hoàn toàn dữ liệu DB và test lại quá trình khởi tạo replication từ đầu, chạy `docker compose down -v` rồi `docker compose up -d --build`.)*

---

## 3. Kịch bản Test 4 Tính Năng (Demo / Quay Video)

### Kịch bản 1: Test Load Balancer (Round Robin)
Gửi nhiều request liên tiếp tới `/api/health` hoặc `/api/server-info` để thấy Nginx xoay vòng lần lượt qua Server 1 -> Server 2 -> Server 3:

**Trên PowerShell (Windows):**
```powershell
1..6 | ForEach-Object {
  $res = Invoke-WebRequest -Uri "http://localhost/api/health" -UseBasicParsing
  Write-Host "Request $_ -> X-Served-By:" $res.Headers["X-Served-By"] "| Body:" $res.Content
}
```

**Hoặc dùng `curl`:**
```bash
for i in 1 2 3 4 5 6; do
  curl -s -D - http://localhost/api/health | grep -E "X-Served-By|serverName"
done
```
**Kết quả mong đợi:** Các request lần lượt trả về `Backend Server 1`, `Backend Server 2`, `Backend Server 3`, lặp lại đều đặn.

---

### Kịch bản 2: Test High Availability (Chịu lỗi khi 1 Server sập)
1. Tắt đột ngột `server-2`:
   ```bash
   docker stop server-2
   ```
2. Gọi lại API nhiều lần hoặc thao tác trên web `http://localhost`:
   ```powershell
   1..6 | ForEach-Object {
     $res = Invoke-WebRequest -Uri "http://localhost/api/health" -UseBasicParsing
     Write-Host "Request $_ -> X-Served-By:" $res.Headers["X-Served-By"]
   }
   ```
   **Kết quả mong đợi:** Hệ thống vẫn hoạt động bình thường, không báo lỗi 502; Nginx tự động điều hướng request chỉ sang `Backend Server 1` và `Backend Server 3`.
3. Khởi động lại `server-2`:
   ```bash
   docker start server-2
   ```

---

### Kịch bản 3: Test Shared Database & Shared Redis Cache
1. Thêm mới một lớp học (ví dụ qua UI `http://localhost` hoặc `curl` gọi vào Load Balancer — giả sử request rơi vào `Backend Server 1`):
   ```bash
   curl -X POST http://localhost/api/classes \
     -H "Content-Type: application/json" \
     -d '{"MaLop":"DEMO01","TenLop":"Lớp Demo Docker"}'
   ```
2. Gọi `GET /api/classes` nhiều lần liên tiếp để request rơi sang `Backend Server 2` và `Backend Server 3`:
   ```powershell
   1..3 | ForEach-Object {
     $res = Invoke-WebRequest -Uri "http://localhost/api/classes" -UseBasicParsing
     Write-Host "Server:" $res.Headers["X-Served-By"]
     Write-Host $res.Content
   }
   ```
   **Kết quả mong đợi:** Cả 3 server đều trả về dữ liệu mới có lớp `DEMO01` (vì dùng chung `db-master` và đồng bộ invalidation qua `redis`).

---

### Kịch bản 4: Test DB Backup Replication (Master -> Slave)
1. Kiểm tra trạng thái replication trên `db-master`:
   ```bash
   docker exec -it db-master psql -U postgres -d examschedule -c "SELECT client_addr, state, sync_state FROM pg_stat_replication;"
   ```
   **Kết quả mong đợi:** Hiển thị 1 dòng kết nối từ `db-slave` với `state = streaming`.
2. Truy vấn trực tiếp dữ liệu trên `db-slave` để chứng minh dữ liệu vừa thêm ở Kịch bản 3 đã tự động sao lưu sang:
   ```bash
   docker exec -it db-slave psql -U postgres -d examschedule -c 'SELECT * FROM "LopHoc";'
   ```
   ```bash
   docker exec -it db-slave psql -U postgres -d examschedule -c 'SELECT * FROM "SinhVien";'
   ```
   **Kết quả mong đợi:** Lớp `DEMO01` (và mọi sinh viên vừa thêm/sửa) xuất hiện ngay lập tức trên `db-slave`.
3. Kiểm chứng `db-slave` đang ở chế độ Read-Only Standby:
   ```bash
   docker exec -it db-slave psql -U postgres -d examschedule -c "SELECT pg_is_in_recovery();"
   ```
   **Kết quả mong đợi:** Trả về `t` (`true`).
