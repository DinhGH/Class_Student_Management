const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const { responseCache, pageCache } = require("./cacheMiddleware");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

//comment for test
//comment for test1
// Helper xếp loại học lực sinh viên.
function getXepLoai(diemTB) {
  const diem = Number(diemTB);
  if (isNaN(diem)) return "Chưa có";
  if (diem >= 9.0) return "Xuất sắc";
  if (diem >= 8.0) return "Giỏi";
  if (diem >= 6.5) return "Khá";
  if (diem >= 5.0) return "Trung bình";
  return "Yếu";
}

// Helper định dạng ngày sinh YYYY-MM-DD
function formatDate(date) {
  if (!date) return null;
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// -------------------------------------------------------------
// Các tác vụ thống kê cho Demo Đồng bộ vs Bất đồng bộ
// -------------------------------------------------------------

// Tác vụ 1: Đếm tổng lớp, sinh viên và điểm trung bình toàn trường
async function getSummaryTask() {
  const [totalClasses, totalStudents, avgResult] = await Promise.all([
    prisma.lopHoc.count(),
    prisma.sinhVien.count(),
    prisma.sinhVien.aggregate({
      _avg: { DiemTB: true },
    }),
  ]);
  const avg = avgResult._avg.DiemTB;
  return {
    TotalClasses: totalClasses,
    TotalStudents: totalStudents,
    AvgScore: avg !== null && avg !== undefined ? Number(avg.toFixed(2)) : 0,
  };
}

// Tác vụ 2: Lấy thủ khoa (topStudentRes)
async function getTopStudentTask() {
  const top = await prisma.sinhVien.findFirst({
    orderBy: [{ DiemTB: "desc" }, { HoTen: "asc" }],
    include: {
      lopHoc: {
        select: { TenLop: true },
      },
    },
  });

  if (!top) return null;
  return {
    ID: top.ID,
    HoTen: top.HoTen,
    MaLop: top.MaLop,
    TenLop: top.lopHoc?.TenLop || null,
    DiemTB:
      top.DiemTB !== null && top.DiemTB !== undefined
        ? Number(top.DiemTB)
        : null,
    NgaySinh: formatDate(top.NgaySinh),
  };
}

// Tác vụ 3: Phân loại học lực
async function getRankTask() {
  const [xuatSac, gioi, kha, trungBinh, yeu] = await Promise.all([
    prisma.sinhVien.count({ where: { DiemTB: { gte: 9.0 } } }),
    prisma.sinhVien.count({ where: { DiemTB: { gte: 8.0, lt: 9.0 } } }),
    prisma.sinhVien.count({ where: { DiemTB: { gte: 6.5, lt: 8.0 } } }),
    prisma.sinhVien.count({ where: { DiemTB: { gte: 5.0, lt: 6.5 } } }),
    prisma.sinhVien.count({ where: { DiemTB: { lt: 5.0 } } }),
  ]);
  return {
    XuatSac: xuatSac,
    Gioi: gioi,
    Kha: kha,
    TrungBinh: trungBinh,
    Yeu: yeu,
  };
}

// Hàm X: thực thi tác vụ và cố tình wait đúng 1 giây theo yêu cầu của Thầy
async function executeTaskX(taskFn, taskName) {
  const start = performance.now();
  const res = await taskFn();
  await delay(1000); // Thầy yêu cầu: hàm X wait đúng 1 giây (1000ms)
  const duration = performance.now() - start;
  return { res, duration, taskName };
}

async function fetchStatsData(mode = "async") {
  let r1, r2, r3;
  const startTime = performance.now();

  if (mode === "sync") {
    // 1. Chế độ ĐỒNG BỘ TUẦN TỰ (Sequential):
    // Gọi hàm X lần 1 (1s) -> chờ xong -> gọi hàm X lần 2 (1s) -> chờ xong -> gọi hàm X lần 3 (1s)
    // => Tổng thời gian = ~3 giây (khoảng 3000ms)
    r1 = await executeTaskX(getSummaryTask, "Summary Task");
    r2 = await executeTaskX(getTopStudentTask, "topStudentRes Task");
    r3 = await executeTaskX(getRankTask, "Ranks Task");
  } else {
    // 2. Chế độ BẤT ĐỒNG BỘ SONG SONG (Parallel Async với Promise.all):
    // Gọi đồng thời cả 3 hàm X cùng lúc -> cả 3 hàm cùng wait 1 giây song song
    // => Tổng thời gian chỉ tốn = ~1 giây (khoảng 1000ms)
    [r1, r2, r3] = await Promise.all([
      executeTaskX(getSummaryTask, "Summary Task"),
      executeTaskX(getTopStudentTask, "topStudentRes Task"),
      executeTaskX(getRankTask, "Ranks Task"),
    ]);
  }

  const totalTime = performance.now() - startTime;
  const summary = r1.res;
  const topStudent = r2.res;
  const ranks = r3.res;

  return {
    totalClasses: summary.TotalClasses,
    totalStudents: summary.TotalStudents,
    avgScore: summary.AvgScore,
    topStudent: topStudent || null,
    ranks: {
      xuatSac: ranks.XuatSac || 0,
      gioi: ranks.Gioi || 0,
      kha: ranks.Kha || 0,
      trungBinh: ranks.TrungBinh || 0,
      yeu: ranks.Yeu || 0,
    },
    meta: {
      executionMode: mode,
      executionTimeMs: Number(totalTime.toFixed(2)),
      expectedTime:
        mode === "sync"
          ? "Khoảng ~3.000 ms (3 giây: 3 tác vụ x 1s tuần tự)"
          : "Khoảng ~1.000 ms (1 giây: 3 tác vụ chạy song song)",
      tasksBreakdownMs: {
        summaryTask: Number(r1.duration.toFixed(2)),
        topStudentTask: Number(r2.duration.toFixed(2)),
        ranksTask: Number(r3.duration.toFixed(2)),
      },
    },
  };
}

// -------------------------------------------------------------
// Health Check API
// -------------------------------------------------------------
app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", dbConnected: true });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// -------------------------------------------------------------
// THỐNG KÊ (DASHBOARD STATS) VỚI CÁC CHẾ ĐỘ:
// 1. /api/stats : FULL-PAGE RESPONSE CACHE (Mặc định 60 giây)
// 2. /api/stats-sync : KHÔNG CACHE, Chạy TUẦN TỰ ĐỒNG BỘ
// 3. /api/stats-async : KHÔNG CACHE, Chạy SONG SONG BẤT ĐỒNG BỘ
// -------------------------------------------------------------

// 1. API chính: FULL-PAGE CACHE (Tầng Middleware HTTP Express)
app.get("/api/stats", pageCache(60), async (req, res) => {
  try {
    const data = await fetchStatsData("async");
    res.json({
      success: true,
      data,
      cache: {
        type: "Full-Page-Response-Cache",
        status: "GENERATED_NEW",
      },
    });
  } catch (err) {
    console.error("Error fetching stats:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi lấy dữ liệu thống kê: " + err.message,
    });
  }
});

// 2. API đo lường: ĐỒNG BỘ / TUẦN TỰ (Sequential execution, No Cache)
app.get("/api/stats-sync", async (req, res) => {
  try {
    res.setHeader("X-Execution-Mode", "SYNC-SEQUENTIAL");
    const data = await fetchStatsData("sync");
    res.json({
      success: true,
      data,
      description:
        "Chạy tuần tự đồng bộ từng query (Summary -> topStudentRes -> Ranks)",
    });
  } catch (err) {
    console.error("Error fetching stats-sync:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi lấy dữ liệu thống kê: " + err.message,
    });
  }
});

// 3. API đo lường: BẤT ĐỒNG BỘ SONG SONG (Parallel Async với Promise.all, No Cache)
app.get("/api/stats-async", async (req, res) => {
  try {
    res.setHeader("X-Execution-Mode", "ASYNC-PARALLEL");
    const data = await fetchStatsData("async");
    res.json({
      success: true,
      data,
      description: "Chạy song song bất đồng bộ cả 3 query bằng Promise.all",
    });
  } catch (err) {
    console.error("Error fetching stats-async:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi lấy dữ liệu thống kê: " + err.message,
    });
  }
});

// 4. API Thông tin Cache hiện tại
app.get("/api/stats/cache-info", (req, res) => {
  res.json({
    success: true,
    cacheInfo: responseCache.getStats(),
  });
});

// 5. API Xóa Cache thủ công
app.post("/api/stats/clear-cache", (req, res) => {
  const count = responseCache.invalidate("/api/stats");
  res.json({
    success: true,
    message: `Đã xóa ${count} cache của trang thống kê!`,
  });
});

// -------------------------------------------------------------
// QUẢN LÝ LỚP HỌC (CLASSES CRUD)
// Khi thêm/sửa/xóa lớp học -> Tự động xóa cache của trang thống kê
// -------------------------------------------------------------

// 1. Danh sách lớp học kèm sĩ số và điểm trung bình lớp
app.get("/api/classes", async (req, res) => {
  try {
    const classes = await prisma.lopHoc.findMany({
      orderBy: { MaLop: "asc" },
      include: {
        sinhViens: {
          select: { DiemTB: true },
        },
      },
    });

    const data = classes.map((c) => {
      const count = c.sinhViens.length;
      const validScores = c.sinhViens
        .map((s) => s.DiemTB)
        .filter((s) => s !== null && s !== undefined && !isNaN(Number(s)));
      const avg =
        validScores.length > 0
          ? Number(
              (
                validScores.reduce((a, b) => a + Number(b), 0) /
                validScores.length
              ).toFixed(2),
            )
          : 0;

      return {
        ID: c.ID,
        MaLop: c.MaLop,
        TenLop: c.TenLop,
        SoLuongSinhVien: count,
        DiemTBLop: avg,
      };
    });

    res.json({ success: true, data });
  } catch (err) {
    console.error("Error fetching classes:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi lấy danh sách lớp học: " + err.message,
    });
  }
});

// 2. Thêm mới lớp học
app.post("/api/classes", async (req, res) => {
  try {
    const { MaLop, TenLop } = req.body;
    const cleanMaLop = (MaLop || "").trim().toUpperCase();
    const cleanTenLop = (TenLop || "").trim();

    if (!cleanMaLop || !cleanTenLop) {
      return res.status(400).json({
        success: false,
        message: "Mã lớp và tên lớp không được để trống!",
      });
    }

    const checkRes = await prisma.lopHoc.findUnique({
      where: { MaLop: cleanMaLop },
    });

    if (checkRes) {
      return res.status(400).json({
        success: false,
        message: `Mã lớp '${cleanMaLop}' đã tồn tại! Vui lòng chọn mã khác.`,
      });
    }

    const newClass = await prisma.lopHoc.create({
      data: {
        MaLop: cleanMaLop,
        TenLop: cleanTenLop,
      },
    });

    // Invalidate Page Cache khi dữ liệu thay đổi
    responseCache.invalidate("/api/stats");

    res.status(201).json({
      success: true,
      message: "Thêm lớp học thành công!",
      data: newClass,
    });
  } catch (err) {
    console.error("Error creating class:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi thêm lớp học: " + err.message,
    });
  }
});

// 3. Sửa thông tin lớp học (ON UPDATE CASCADE sẽ tự động cập nhật SinhVien)
app.put("/api/classes/:id", async (req, res) => {
  try {
    const classId = parseInt(req.params.id, 10);
    if (isNaN(classId)) {
      return res.status(400).json({
        success: false,
        message: "ID lớp học không hợp lệ!",
      });
    }

    const { MaLop, TenLop } = req.body;
    const cleanMaLop = (MaLop || "").trim().toUpperCase();
    const cleanTenLop = (TenLop || "").trim();

    if (!cleanMaLop || !cleanTenLop) {
      return res.status(400).json({
        success: false,
        message: "Mã lớp và tên lớp không được để trống!",
      });
    }

    const currentClass = await prisma.lopHoc.findUnique({
      where: { ID: classId },
    });

    if (!currentClass) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lớp học cần cập nhật!",
      });
    }

    const duplicate = await prisma.lopHoc.findFirst({
      where: {
        MaLop: cleanMaLop,
        NOT: { ID: classId },
      },
    });

    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: `Mã lớp '${cleanMaLop}' đã được sử dụng bởi lớp khác!`,
      });
    }

    const updated = await prisma.lopHoc.update({
      where: { ID: classId },
      data: {
        MaLop: cleanMaLop,
        TenLop: cleanTenLop,
      },
    });

    responseCache.invalidate("/api/stats");

    res.json({
      success: true,
      message: "Cập nhật lớp học thành công!",
      data: updated,
    });
  } catch (err) {
    console.error("Error updating class:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi cập nhật lớp học: " + err.message,
    });
  }
});

// 4. Xóa lớp học
app.delete("/api/classes/:id", async (req, res) => {
  try {
    const classId = parseInt(req.params.id, 10);
    if (isNaN(classId)) {
      return res.status(400).json({
        success: false,
        message: "ID lớp học không hợp lệ!",
      });
    }

    const classObj = await prisma.lopHoc.findUnique({
      where: { ID: classId },
      include: {
        _count: {
          select: { sinhViens: true },
        },
      },
    });

    if (!classObj) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lớp học cần xóa!",
      });
    }

    const studentCount = classObj._count.sinhViens;
    if (studentCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Không thể xóa lớp '${classObj.TenLop}' (${classObj.MaLop}) vì hiện tại đang có ${studentCount} sinh viên. Vui lòng chuyển hoặc xóa các sinh viên này trước!`,
      });
    }

    await prisma.lopHoc.delete({
      where: { ID: classId },
    });

    responseCache.invalidate("/api/stats");

    res.json({
      success: true,
      message: `Đã xóa lớp học '${classObj.TenLop}' thành công!`,
    });
  } catch (err) {
    console.error("Error deleting class:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi xóa lớp học: " + err.message,
    });
  }
});

// -------------------------------------------------------------
// QUẢN LÝ SINH VIÊN (STUDENTS CRUD)
// Khi thêm/sửa/xóa sinh viên -> Tự động xóa cache của trang thống kê
// -------------------------------------------------------------

// 1. Lấy danh sách sinh viên (hỗ trợ tìm kiếm, lọc theo lớp, sắp xếp)
app.get("/api/students", async (req, res) => {
  try {
    const {
      search = "",
      maLop = "",
      sortBy = "HoTen",
      order = "ASC",
    } = req.query;

    const validSortCols = {
      id: "ID",
      hoten: "HoTen",
      diemtb: "DiemTB",
      ngaysinh: "NgaySinh",
      malop: "MaLop",
    };
    const sortField = validSortCols[sortBy.toLowerCase()] || "ID";
    const sortOrder = order.toUpperCase() === "DESC" ? "desc" : "asc";

    const whereConditions = {};

    if (maLop && maLop.trim()) {
      whereConditions.MaLop = maLop.trim();
    }

    if (search && search.trim()) {
      const s = search.trim();
      whereConditions.OR = [
        { HoTen: { contains: s, mode: "insensitive" } },
        { MaLop: { contains: s, mode: "insensitive" } },
        { lopHoc: { TenLop: { contains: s, mode: "insensitive" } } },
      ];
    }

    const students = await prisma.sinhVien.findMany({
      where: whereConditions,
      orderBy: { [sortField]: sortOrder },
      include: {
        lopHoc: {
          select: { TenLop: true },
        },
      },
    });

    const dataWithRating = students.map((sv) => ({
      ID: sv.ID,
      HoTen: sv.HoTen,
      MaLop: sv.MaLop,
      TenLop: sv.lopHoc?.TenLop || null,
      DiemTB:
        sv.DiemTB !== null && sv.DiemTB !== undefined
          ? Number(sv.DiemTB)
          : null,
      NgaySinh: formatDate(sv.NgaySinh),
      XepLoai: getXepLoai(sv.DiemTB),
    }));

    res.json({ success: true, data: dataWithRating });
  } catch (err) {
    console.error("Error fetching students:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi lấy danh sách sinh viên: " + err.message,
    });
  }
});

// 2. Thêm mới sinh viên
app.post("/api/students", async (req, res) => {
  try {
    const { HoTen, MaLop, DiemTB, NgaySinh } = req.body;
    const cleanHoTen = (HoTen || "").trim();
    const cleanMaLop = (MaLop || "").trim();
    const numDiemTB = Number(DiemTB);

    if (!cleanHoTen) {
      return res.status(400).json({
        success: false,
        message: "Họ và tên không được để trống!",
      });
    }
    if (!cleanMaLop) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn lớp học cho sinh viên!",
      });
    }
    if (isNaN(numDiemTB) || numDiemTB < 0 || numDiemTB > 10) {
      return res.status(400).json({
        success: false,
        message: "Điểm trung bình phải từ 0.00 đến 10.00!",
      });
    }

    const classExists = await prisma.lopHoc.findUnique({
      where: { MaLop: cleanMaLop },
    });

    if (!classExists) {
      return res.status(400).json({
        success: false,
        message: `Mã lớp '${cleanMaLop}' không tồn tại trong hệ thống!`,
      });
    }

    const cleanDate =
      NgaySinh && NgaySinh.trim() ? new Date(NgaySinh.trim()) : null;

    const newStudent = await prisma.sinhVien.create({
      data: {
        HoTen: cleanHoTen,
        MaLop: cleanMaLop,
        DiemTB: numDiemTB,
        NgaySinh: cleanDate,
      },
      include: {
        lopHoc: {
          select: { TenLop: true },
        },
      },
    });

    responseCache.invalidate("/api/stats");

    res.status(201).json({
      success: true,
      message: "Thêm sinh viên thành công!",
      data: {
        ID: newStudent.ID,
        HoTen: newStudent.HoTen,
        MaLop: newStudent.MaLop,
        TenLop: newStudent.lopHoc?.TenLop || classExists.TenLop,
        DiemTB: Number(newStudent.DiemTB),
        NgaySinh: formatDate(newStudent.NgaySinh),
        XepLoai: getXepLoai(newStudent.DiemTB),
      },
    });
  } catch (err) {
    console.error("Error creating student:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi thêm sinh viên: " + err.message,
    });
  }
});

// 3. Cập nhật thông tin sinh viên
app.put("/api/students/:id", async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10);
    if (isNaN(studentId)) {
      return res.status(400).json({
        success: false,
        message: "ID sinh viên không hợp lệ!",
      });
    }

    const { HoTen, MaLop, DiemTB, NgaySinh } = req.body;
    const cleanHoTen = (HoTen || "").trim();
    const cleanMaLop = (MaLop || "").trim();
    const numDiemTB = Number(DiemTB);

    if (!cleanHoTen) {
      return res.status(400).json({
        success: false,
        message: "Họ và tên không được để trống!",
      });
    }
    if (!cleanMaLop) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn lớp học!",
      });
    }
    if (isNaN(numDiemTB) || numDiemTB < 0 || numDiemTB > 10) {
      return res.status(400).json({
        success: false,
        message: "Điểm trung bình phải từ 0.00 đến 10.00!",
      });
    }

    const existingStudent = await prisma.sinhVien.findUnique({
      where: { ID: studentId },
    });

    if (!existingStudent) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sinh viên cần cập nhật!",
      });
    }

    const classExists = await prisma.lopHoc.findUnique({
      where: { MaLop: cleanMaLop },
    });

    if (!classExists) {
      return res.status(400).json({
        success: false,
        message: `Mã lớp '${cleanMaLop}' không tồn tại!`,
      });
    }

    const cleanDate =
      NgaySinh && NgaySinh.trim() ? new Date(NgaySinh.trim()) : null;

    const updatedStudent = await prisma.sinhVien.update({
      where: { ID: studentId },
      data: {
        HoTen: cleanHoTen,
        MaLop: cleanMaLop,
        DiemTB: numDiemTB,
        NgaySinh: cleanDate,
      },
      include: {
        lopHoc: {
          select: { TenLop: true },
        },
      },
    });

    responseCache.invalidate("/api/stats");

    res.json({
      success: true,
      message: "Cập nhật sinh viên thành công!",
      data: {
        ID: updatedStudent.ID,
        HoTen: updatedStudent.HoTen,
        MaLop: updatedStudent.MaLop,
        TenLop: updatedStudent.lopHoc?.TenLop || classExists.TenLop,
        DiemTB: Number(updatedStudent.DiemTB),
        NgaySinh: formatDate(updatedStudent.NgaySinh),
        XepLoai: getXepLoai(updatedStudent.DiemTB),
      },
    });
  } catch (err) {
    console.error("Error updating student:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi cập nhật sinh viên: " + err.message,
    });
  }
});

// 4. Xóa sinh viên
app.delete("/api/students/:id", async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10);
    if (isNaN(studentId)) {
      return res.status(400).json({
        success: false,
        message: "ID sinh viên không hợp lệ!",
      });
    }

    const student = await prisma.sinhVien.findUnique({
      where: { ID: studentId },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sinh viên cần xóa!",
      });
    }

    await prisma.sinhVien.delete({
      where: { ID: studentId },
    });

    responseCache.invalidate("/api/stats");

    res.json({
      success: true,
      message: `Đã xóa sinh viên '${student.HoTen}' thành công!`,
    });
  } catch (err) {
    console.error("Error deleting student:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi xóa sinh viên: " + err.message,
    });
  }
});

// -------------------------------------------------------------
// KHỞI ĐỘNG SERVER
// -------------------------------------------------------------
let server;
if (require.main === module) {
  server = app.listen(PORT, async () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
    try {
      await prisma.$connect();
      console.log("✅ Đã kết nối cơ sở dữ liệu PostgreSQL qua Prisma!");
    } catch (err) {
      console.error("❌ Lỗi kết nối CSDL khi khởi động:", err.message);
    }
  });
}

module.exports = app;
