const request = require("supertest");
const app = require("../index");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

describe("BỘ KIỂM THỬ TÍCH HỢP HỆ THỐNG (INTEGRATION TESTS - 7 APIS)", () => {
  beforeAll(async () => {
    // Đảm bảo kết nối CSDL sẵn sàng trước khi test
    try {
      await prisma.$connect();
    } catch (e) {
      // Bỏ qua nếu chưa cấu hình URL thật
    }
  });

  afterAll(async () => {
    // Đóng kết nối Prisma sạch sẽ
    try {
      await prisma.$disconnect();
    } catch (e) {}
  });

  // =========================================================================
  // API 1: /api/health (YÊU CẦU: 1 API CHỈ TEST DUY NHẤT 1 NHÁNH)
  // =========================================================================
  describe("API 1: GET /api/health (Chỉ test 1 nhánh)", () => {
    test("Kịch bản 1: [1 Nhánh] Kiểm tra trạng thái máy chủ và kết nối CSDL hoạt động bình thường", async () => {
      const res = await request(app).get("/api/health");
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("status", "ok");
      expect(res.body).toHaveProperty("dbConnected", true);
    });
  });

  // =========================================================================
  // API 2: GET /api/classes (YÊU CẦU: 2 KỊCH BẢN GIỐNG HỆT NHAU, KHÁC MỖI TÊN)
  // =========================================================================
  describe("API 2: GET /api/classes (2 kịch bản giống hệt nhau, khác mỗi tên)", () => {
    test("Kịch bản 2A: Lấy danh sách toàn bộ lớp học thành công kèm sĩ số và điểm trung bình", async () => {
      const res = await request(app).get("/api/classes");
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0]).toHaveProperty("MaLop");
      expect(res.body.data[0]).toHaveProperty("TenLop");
      expect(res.body.data[0]).toHaveProperty("SoLuongSinhVien");
    });

    test("Kịch bản 2B: Lấy danh sách toàn bộ lớp học thành công kèm sĩ số và điểm trung bình (Bản sao đối chiếu kịch bản 2A)", async () => {
      const res = await request(app).get("/api/classes");
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0]).toHaveProperty("MaLop");
      expect(res.body.data[0]).toHaveProperty("TenLop");
      expect(res.body.data[0]).toHaveProperty("SoLuongSinhVien");
    });
  });

  // =========================================================================
  // API 3: POST /api/students (YÊU CẦU: 1 API TEST TẤT CẢ CÁC RẼ NHÁNH CỦA NÓ)
  // =========================================================================
  describe("API 3: POST /api/students (Test TẤT CẢ các trường hợp rẽ nhánh validation)", () => {
    let createdStudentId = null;

    test("Kịch bản 3.1: [Rẽ nhánh 1] Báo lỗi khi thiếu họ tên sinh viên (HoTen rỗng)", async () => {
      const res = await request(app).post("/api/students").send({
        HoTen: "   ",
        MaLop: "CNTT01",
        DiemTB: 8.5,
        NgaySinh: "2004-01-01",
      });
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Họ và tên không được để trống!");
    });

    test("Kịch bản 3.2: [Rẽ nhánh 2] Báo lỗi khi không chọn lớp học (MaLop rỗng)", async () => {
      const res = await request(app).post("/api/students").send({
        HoTen: "Nguyễn Văn Test",
        MaLop: "",
        DiemTB: 8.5,
        NgaySinh: "2004-01-01",
      });
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Vui lòng chọn lớp học cho sinh viên!");
    });

    test("Kịch bản 3.3: [Rẽ nhánh 3] Báo lỗi khi điểm trung bình không hợp lệ (DiemTB = 12 > 10)", async () => {
      const res = await request(app).post("/api/students").send({
        HoTen: "Nguyễn Văn Test",
        MaLop: "CNTT01",
        DiemTB: 12.0,
        NgaySinh: "2004-01-01",
      });
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Điểm trung bình phải từ 0.00 đến 10.00!");
    });

    test("Kịch bản 3.4: [Rẽ nhánh 4] Báo lỗi khi mã lớp không tồn tại trong CSDL", async () => {
      const res = await request(app).post("/api/students").send({
        HoTen: "Nguyễn Văn Test",
        MaLop: "KHONG_TON_TAI_999",
        DiemTB: 7.5,
        NgaySinh: "2004-01-01",
      });
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("không tồn tại trong hệ thống");
    });

    test("Kịch bản 3.5: [Rẽ nhánh 5] Thêm sinh viên thành công với đầy đủ dữ liệu hợp lệ và tự động xếp loại", async () => {
      const res = await request(app).post("/api/students").send({
        HoTen: "Trần Kiểm Thử Tích Hợp",
        MaLop: "CNTT01",
        DiemTB: 9.6,
        NgaySinh: "2004-05-10",
      });
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.HoTen).toBe("Trần Kiểm Thử Tích Hợp");
      expect(res.body.data.XepLoai).toBe("Xuất sắc");
      createdStudentId = res.body.data.ID;
    });

    // Dọn dẹp dữ liệu test
    afterAll(async () => {
      if (createdStudentId) {
        await request(app).delete(`/api/students/${createdStudentId}`);
      }
    });
  });

  // =========================================================================
  // API 4: POST /api/classes (Thêm lớp học hợp lệ)
  // =========================================================================
  describe("API 4: POST /api/classes (Thêm lớp học)", () => {
    let createdClassId = null;
    const testMaLop = `TEST_${Date.now().toString().slice(-5)}`;

    test("Kịch bản 4: Thêm mới lớp học hợp lệ thành công", async () => {
      const res = await request(app).post("/api/classes").send({
        MaLop: testMaLop,
        TenLop: "Lớp Kiểm Thử Tự Động",
      });
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.MaLop).toBe(testMaLop);
      createdClassId = res.body.data.ID;
    });

    // Dọn dẹp lớp test
    afterAll(async () => {
      if (createdClassId) {
        await request(app).delete(`/api/classes/${createdClassId}`);
      }
    });
  });

  // =========================================================================
  // API 5: DELETE /api/classes/:id (Ràng buộc khóa ngoại không cho xóa khi còn SV)
  // =========================================================================
  describe("API 5: DELETE /api/classes/:id (Ràng buộc toàn vẹn)", () => {
    test("Kịch bản 5: Ngăn chặn xóa lớp học khi lớp vẫn đang có sinh viên", async () => {
      // Lớp ID 1 (CNTT01) luôn có sinh viên trong CSDL
      const res = await request(app).delete("/api/classes/1");
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Không thể xóa lớp");
    });
  });

  // =========================================================================
  // API 6: GET /api/stats (YÊU CẦU: KỊCH BẢN CỐ TÌNH THẤT BẠI 1)
  // =========================================================================
  describe("API 6: GET /api/stats (Cố tình FAIL - Test case 1)", () => {
    test("Kịch bản 6: [CỐ TÌNH THẤT BẠI 1] API thực tế trả về 200 OK nhưng kịch bản cố tình mong đợi 400 Bad Request", async () => {
      const res = await request(app).get("/api/stats");
      // Thực tế API trả về 200, nhưng test cố tình expect 400 để tạo ra kết quả FAIL theo đúng đề bài
      expect(res.statusCode).toBe(400);
    });
  });

  // =========================================================================
  // API 7: GET /api/students (YÊU CẦU: KỊCH BẢN CỐ TÌNH THẤT BẠI 2)
  // =========================================================================
  describe("API 7: GET /api/students (Cố tình FAIL - Test case 2)", () => {
    test("Kịch bản 7: [CỐ TÌNH THẤT BẠI 2] API thực tế trả về 200 OK nhưng kịch bản cố tình mong đợi 404 Not Found", async () => {
      const res = await request(app).get("/api/students");
      // Thực tế API trả về 200, nhưng test cố tình expect 404 để tạo ra kết quả FAIL theo đúng đề bài
      expect(res.statusCode).toBe(404);
    });
  });
});
