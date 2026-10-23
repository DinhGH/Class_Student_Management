import React, { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  GraduationCap,
  School,
  Search,
  Plus,
  Edit2,
  Trash2,
  Award,
  Users,
  BookOpen,
  TrendingUp,
  X,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Calendar,
  Sparkles,
  ArrowUpDown,
  Zap,
  RefreshCw,
  Clock,
  Activity,
  Flame,
} from "lucide-react";
import { api } from "./services/api";
import "./App.css";

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState("dashboard");

  // Data states
  const [stats, setStats] = useState(null);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);

  // Search & Filter
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [sortBy, setSortBy] = useState("HoTen");
  const [sortOrder, setSortOrder] = useState("ASC");

  // Loading states
  const [loading, setLoading] = useState(true);

  // Toast feedback
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
  });

  // Student Form Modal
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [studentFormData, setStudentFormData] = useState({
    ID: null,
    HoTen: "",
    MaLop: "",
    DiemTB: "",
    NgaySinh: "",
  });

  // Class Form Modal
  const [classModalOpen, setClassModalOpen] = useState(false);
  const [classFormData, setClassFormData] = useState({
    ID: null,
    MaLop: "",
    TenLop: "",
  });

  // Delete Confirmation Modal
  const [deleteModal, setDeleteModal] = useState({
    open: false,
    type: null, // 'student' | 'class'
    item: null,
  });

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 3500);
  };

  // Cache & Performance State
  const [cacheMeta, setCacheMeta] = useState({
    status: "MISS",
    durationMs: null,
    mode: "async",
    breakdown: null,
    cacheType: "Full-Page-Memory",
  });
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  // Fetch Stats
  const loadStats = useCallback(async (useCache = true) => {
    try {
      const res = await api.getStats(useCache);
      if (res.success) {
        setStats(res.data);
        setCacheMeta({
          status: res._headers.cache || (useCache ? "HIT" : "BYPASS"),
          durationMs: res._clientDurationMs,
          mode: res.data.meta?.executionMode || "async",
          breakdown: res.data.meta?.queryBreakdownMs || null,
          cacheType: res._headers.cacheType || "Full-Page-Memory",
        });
      }
    } catch (err) {
      console.error("Lỗi tải thống kê:", err);
    }
  }, []);

  // Handlers for interactive testing
  const handleTestCached = async () => {
    setIsTesting(true);
    try {
      const res = await api.getStats(true);
      setTestResult({
        title: "1. Lần Gọi CÓ FULL-PAGE CACHE (~1 ms)",
        status: res._headers.cache || "HIT",
        clientDuration: res._clientDurationMs,
        executionMode: res.data.meta?.executionMode,
        serverTime: res.data.meta?.executionTimeMs,
        description:
          "Bỏ qua hoàn toàn hàm X và truy vấn database! Express Middleware trả thẳng toàn bộ trang từ RAM siêu tốc trong ~1 ms.",
      });
      loadStats(true);
      showToast("Đã gọi API với Full-Page Cache!");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestSync = async () => {
    setIsTesting(true);
    try {
      const res = await api.getStatsSync();
      setTestResult({
        title: "2. Lần Gọi ĐỒNG BỘ TUẦN TỰ (Sync ~3 giây)",
        status: "NO_CACHE",
        clientDuration: res._clientDurationMs,
        executionMode: "sync",
        serverTime: res.data.meta?.executionTimeMs,
        breakdown: res.data.meta?.tasksBreakdownMs,
        description:
          "Hàm X wait 1 giây theo đúng đề bài của Thầy. Gọi 3 lần hàm X tuần tự: Summary (1s) -> topStudentRes (1s) -> Ranks (1s) => Tổng thời gian tốn ~3.000 ms (3 giây)!",
      });
      setStats(res.data);
      showToast("Đã thực thi xong chế độ Đồng bộ tuần tự (~3s)!");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestAsync = async () => {
    setIsTesting(true);
    try {
      const res = await api.getStatsAsync();
      setTestResult({
        title: "3. Lần Gọi BẤT ĐỒNG BỘ SONG SONG (Async ~1 giây)",
        status: "NO_CACHE",
        clientDuration: res._clientDurationMs,
        executionMode: "async",
        serverTime: res.data.meta?.executionTimeMs,
        breakdown: res.data.meta?.tasksBreakdownMs,
        description:
          "Hàm X wait 1 giây theo đúng đề bài của Thầy. Gọi đồng thời cả 3 hàm X (bao gồm topStudentRes) bằng Promise.all => Cả 3 cùng chạy song song, tổng thời gian chỉ tốn ~1.000 ms (1 giây)!",
      });
      setStats(res.data);
      showToast("Đã thực thi xong chế độ Bất đồng bộ song song (~1s)!");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setIsTesting(false);
    }
  };

  const handleClearCache = async () => {
    try {
      const res = await api.clearStatsCache();
      showToast(res.message);
      // Gọi lại ngay để tạo Cache MISS đầu tiên
      loadStats(true);
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  // Fetch Classes
  const loadClasses = useCallback(async () => {
    try {
      const res = await api.getClasses();
      if (res.success) setClasses(res.data);
    } catch (err) {
      console.error("Lỗi tải lớp học:", err);
    }
  }, []);

  // Fetch Students
  const loadStudents = useCallback(async () => {
    try {
      const res = await api.getStudents({
        search,
        maLop: filterClass,
        sortBy,
        order: sortOrder,
      });
      if (res.success) setStudents(res.data);
    } catch (err) {
      console.error("Lỗi tải sinh viên:", err);
    }
  }, [search, filterClass, sortBy, sortOrder]);

  // Initial load
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      await Promise.all([loadStats(), loadClasses(), loadStudents()]);
      setLoading(false);
    };
    initData();
  }, [loadStats, loadClasses, loadStudents]);

  // Handle Search & Filter trigger
  useEffect(() => {
    loadStudents();
  }, [search, filterClass, sortBy, sortOrder, loadStudents]);

  // Format Date (YYYY-MM-DD -> DD/MM/YYYY)
  const formatDate = (dateStr) => {
    if (!dateStr) return "Chưa cập nhật";
    const parts = dateStr.split("T")[0].split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Badge rank class helper
  const getRankBadgeClass = (rank) => {
    switch (rank) {
      case "Xuất sắc":
        return "badge-rank-xuatsac";
      case "Giỏi":
        return "badge-rank-gioi";
      case "Khá":
        return "badge-rank-kha";
      case "Trung bình":
        return "badge-rank-trungbinh";
      default:
        return "badge-rank-yeu";
    }
  };

  // -------------------------------------------------------------
  // STUDENT ACTIONS
  // -------------------------------------------------------------
  const handleOpenStudentModal = (student = null) => {
    if (student) {
      setStudentFormData({
        ID: student.ID,
        HoTen: student.HoTen,
        MaLop: student.MaLop,
        DiemTB: student.DiemTB,
        NgaySinh: student.NgaySinh ? student.NgaySinh.split("T")[0] : "",
      });
    } else {
      setStudentFormData({
        ID: null,
        HoTen: "",
        MaLop: classes.length > 0 ? classes[0].MaLop : "",
        DiemTB: "",
        NgaySinh: "",
      });
    }
    setStudentModalOpen(true);
  };

  const handleSaveStudent = async (e) => {
    e.preventDefault();
    if (!studentFormData.HoTen.trim()) {
      showToast("Vui lòng nhập họ và tên sinh viên!", "error");
      return;
    }
    if (!studentFormData.MaLop) {
      showToast("Vui lòng chọn lớp học!", "error");
      return;
    }
    const diem = parseFloat(studentFormData.DiemTB);
    if (isNaN(diem) || diem < 0 || diem > 10) {
      showToast("Điểm trung bình phải từ 0.00 đến 10.00!", "error");
      return;
    }

    try {
      if (studentFormData.ID) {
        // Update
        const res = await api.updateStudent(
          studentFormData.ID,
          studentFormData,
        );
        showToast(res.message || "Cập nhật sinh viên thành công!");
      } else {
        // Create
        const res = await api.createStudent(studentFormData);
        showToast(res.message || "Thêm sinh viên thành công!");
      }
      setStudentModalOpen(false);
      loadStudents();
      loadClasses();
      loadStats();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  // -------------------------------------------------------------
  // CLASS ACTIONS
  // -------------------------------------------------------------
  const handleOpenClassModal = (cls = null) => {
    if (cls) {
      setClassFormData({
        ID: cls.ID,
        MaLop: cls.MaLop,
        TenLop: cls.TenLop,
      });
    } else {
      setClassFormData({
        ID: null,
        MaLop: "",
        TenLop: "",
      });
    }
    setClassModalOpen(true);
  };

  const handleSaveClass = async (e) => {
    e.preventDefault();
    if (!classFormData.MaLop.trim() || !classFormData.TenLop.trim()) {
      showToast("Vui lòng nhập đầy đủ mã lớp và tên lớp!", "error");
      return;
    }

    try {
      if (classFormData.ID) {
        // Update
        const res = await api.updateClass(classFormData.ID, classFormData);
        showToast(res.message || "Cập nhật lớp học thành công!");
      } else {
        // Create
        const res = await api.createClass(classFormData);
        showToast(res.message || "Thêm lớp học thành công!");
      }
      setClassModalOpen(false);
      loadClasses();
      loadStudents();
      loadStats();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  // -------------------------------------------------------------
  // DELETE CONFIRMATION
  // -------------------------------------------------------------
  const handleConfirmDelete = async () => {
    const { type, item } = deleteModal;
    if (!item) return;

    try {
      if (type === "student") {
        const res = await api.deleteStudent(item.ID);
        showToast(res.message);
      } else if (type === "class") {
        const res = await api.deleteClass(item.ID);
        showToast(res.message);
      }
      setDeleteModal({ open: false, type: null, item: null });
      loadClasses();
      loadStudents();
      loadStats();
    } catch (err) {
      showToast(err.message, "error");
      setDeleteModal({ open: false, type: null, item: null });
    }
  };

  return (
    <div className="app-container">
      {/* Toast Notifications */}
      {toast.show && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            {toast.type === "success" ? (
              <CheckCircle size={20} />
            ) : (
              <AlertCircle size={20} />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="app-header">
        <div className="header-brand">
          <div className="header-icon-box">
            <GraduationCap size={30} />
          </div>
          <div className="header-title-box">
            <h1>Hệ Thống Quản Lý Sinh Viên & Lớp Học</h1>
            <p>Kiến trúc Phần mềm • Cơ sở dữ liệu Microsoft SQL Server</p>
          </div>
        </div>
        <div className="header-status-badge">
          <span className="status-dot"></span>
          <span>SQL Server: Kết nối thành công</span>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="nav-tabs">
        <button
          className={`tab-btn ${activeTab === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveTab("dashboard")}
        >
          <LayoutDashboard size={18} />
          <span>Tổng Quan</span>
        </button>
        <button
          className={`tab-btn ${activeTab === "students" ? "active" : ""}`}
          onClick={() => setActiveTab("students")}
        >
          <Users size={18} />
          <span>Quản Lý Sinh Viên ({students.length})</span>
        </button>
        <button
          className={`tab-btn ${activeTab === "classes" ? "active" : ""}`}
          onClick={() => setActiveTab("classes")}
        >
          <School size={18} />
          <span>Quản Lý Lớp Học ({classes.length})</span>
        </button>
      </nav>

      {/* -------------------------------------------------------------
          TAB 1: TỔNG QUAN (DASHBOARD)
      ------------------------------------------------------------- */}
      {activeTab === "dashboard" && stats && (
        <>
          {/* Cache & Benchmark Control Panel */}
          <div className="cache-monitor-card">
            <div className="cache-monitor-header">
              <div className="cache-monitor-title">
                <Flame size={20} color="#0284c7" />
                <span>
                  Kiểm Tra Full-Page Cache & Bất Đồng Bộ (Báo Cáo Thầy Cô)
                </span>
              </div>
              <div className="cache-badges-group">
                <span
                  className={`cache-pill ${cacheMeta.status === "HIT" ? "hit" : "miss"}`}
                >
                  <Zap size={13} />
                  X-Cache:{" "}
                  {cacheMeta.status === "HIT"
                    ? "HIT (Đọc từ RAM)"
                    : "MISS (Đọc từ CSDL)"}
                </span>
                <span className="cache-pill time">
                  <Clock size={13} />
                  Thời gian:{" "}
                  {cacheMeta.durationMs ? `${cacheMeta.durationMs} ms` : "N/A"}
                </span>
                <span className="cache-pill time">
                  <Activity size={13} />
                  Chế độ:{" "}
                  {cacheMeta.mode === "sync"
                    ? "Đồng bộ (Sync)"
                    : "Bất đồng bộ (Async)"}
                </span>
              </div>
            </div>

            <div className="benchmark-btn-grid">
              <button
                className="btn-test"
                onClick={handleTestCached}
                disabled={isTesting}
                title="Gọi API có Full-Page Cache (Phản hồi tức thời từ RAM)"
              >
                <Zap size={15} color="#16a34a" />
                <span>1. Test Có Cache (Full Page)</span>
              </button>

              <button
                className="btn-test"
                onClick={handleTestSync}
                disabled={isTesting}
                title="Gọi tuần tự đồng bộ từng query: summary -> topStudentRes -> ranks"
              >
                <Clock size={15} color="#ea580c" />
                <span>2. Test Đồng Bộ (Sync Tuần Tự)</span>
              </button>

              <button
                className="btn-test"
                onClick={handleTestAsync}
                disabled={isTesting}
                title="Gọi song song bất đồng bộ bằng Promise.all"
              >
                <Activity size={15} color="#2563eb" />
                <span>3. Test Bất Đồng Bộ (Async Song Song)</span>
              </button>

              <button
                className="btn-test clear"
                onClick={handleClearCache}
                disabled={isTesting}
                title="Xóa toàn bộ Cache trang để tạo lại Cache MISS"
              >
                <RefreshCw size={15} />
                <span>Xóa Cache</span>
              </button>
            </div>

            {testResult && (
              <div className="benchmark-result-panel">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <strong style={{ color: "#0369a1", fontSize: "14px" }}>
                    {testResult.title}
                  </strong>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#475569",
                    }}
                  >
                    Client Roundtrip:{" "}
                    <strong style={{ color: "#0f172a" }}>
                      {testResult.clientDuration} ms
                    </strong>
                    {testResult.serverTime &&
                      ` | Server DB: ${testResult.serverTime} ms`}
                  </span>
                </div>
                <p
                  style={{
                    margin: "4px 0",
                    fontSize: "13px",
                    color: "#475569",
                  }}
                >
                  {testResult.description}
                </p>
                {testResult.breakdown && (
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#64748b",
                      background: "#f8fafc",
                      padding: "6px 10px",
                      borderRadius: "4px",
                    }}
                  >
                    ⏱️ Chi tiết thời gian từng query: Summary:{" "}
                    <strong>{testResult.breakdown.summaryQuery}ms</strong> |
                    topStudentRes:{" "}
                    <strong>{testResult.breakdown.topStudentQuery}ms</strong> |
                    ranks: <strong>{testResult.breakdown.rankQuery}ms</strong>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon primary">
                <Users size={26} />
              </div>
              <div className="stat-info">
                <div className="stat-label">Tổng số sinh viên</div>
                <div className="stat-value">{stats.totalStudents}</div>
                <div className="stat-sub">Đang theo học</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon success">
                <School size={26} />
              </div>
              <div className="stat-info">
                <div className="stat-label">Tổng số lớp học</div>
                <div className="stat-value">{stats.totalClasses}</div>
                <div className="stat-sub">Lớp chuyên ngành</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon warning">
                <TrendingUp size={26} />
              </div>
              <div className="stat-info">
                <div className="stat-label">Điểm TB toàn trường</div>
                <div className="stat-value">
                  {Number(stats.avgScore).toFixed(2)}
                </div>
                <div className="stat-sub">Thang điểm 10.0</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon purple">
                <Award size={26} />
              </div>
              <div className="stat-info">
                <div className="stat-label">Xếp loại giỏi & xuất sắc</div>
                <div className="stat-value">
                  {(stats.ranks.xuatSac || 0) + (stats.ranks.gioi || 0)}
                </div>
                <div className="stat-sub">
                  {stats.totalStudents > 0
                    ? `${Math.round((((stats.ranks.xuatSac || 0) + (stats.ranks.gioi || 0)) / stats.totalStudents) * 100)}% toàn trường`
                    : "0%"}
                </div>
              </div>
            </div>
          </div>

          <div className="dashboard-sections">
            {/* Phân loại học lực */}
            <div className="panel-card">
              <h3 className="panel-title">
                <Sparkles size={20} color="#6366f1" />
                Phân Loại Học Lực Sinh Viên
              </h3>
              <div className="rank-bars-list">
                {[
                  {
                    name: "Xuất sắc (>= 9.0)",
                    count: stats.ranks.xuatSac,
                    color: "#9333ea",
                    dot: "#c084fc",
                  },
                  {
                    name: "Giỏi (8.0 - 8.9)",
                    count: stats.ranks.gioi,
                    color: "#10b981",
                    dot: "#34d399",
                  },
                  {
                    name: "Khá (6.5 - 7.9)",
                    count: stats.ranks.kha,
                    color: "#3b82f6",
                    dot: "#60a5fa",
                  },
                  {
                    name: "Trung bình (5.0 - 6.4)",
                    count: stats.ranks.trungBinh,
                    color: "#f59e0b",
                    dot: "#fbbf24",
                  },
                  {
                    name: "Yếu (< 5.0)",
                    count: stats.ranks.yeu,
                    color: "#ef4444",
                    dot: "#f87171",
                  },
                ].map((item, idx) => {
                  const percent =
                    stats.totalStudents > 0
                      ? (item.count / stats.totalStudents) * 100
                      : 0;
                  return (
                    <div className="rank-item" key={idx}>
                      <div className="rank-item-header">
                        <span className="rank-name">
                          <span
                            className="rank-tag-dot"
                            style={{ backgroundColor: item.dot }}
                          ></span>
                          {item.name}
                        </span>
                        <span>
                          <strong>{item.count}</strong> sinh viên (
                          {percent.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="rank-progress-bg">
                        <div
                          className="rank-progress-fill"
                          style={{
                            width: `${percent}%`,
                            backgroundColor: item.color,
                          }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Thủ khoa trường */}
              {stats.topStudent && (
                <div className="top-student-banner">
                  <div className="top-student-avatar">
                    {stats.topStudent.HoTen.charAt(0)}
                  </div>
                  <div className="top-student-details">
                    <h4>🌟 Thủ Khoa: {stats.topStudent.HoTen}</h4>
                    <p>
                      Lớp: <strong>{stats.topStudent.TenLop}</strong> (
                      {stats.topStudent.MaLop})
                    </p>
                  </div>
                  <div className="top-student-badge">
                    {stats.topStudent.DiemTB.toFixed(2)} Điểm
                  </div>
                </div>
              )}
            </div>

            {/* Thống kê nhanh danh sách lớp */}
            <div className="panel-card">
              <h3 className="panel-title">
                <BookOpen size={20} color="#0ea5e9" />
                Tình Hình Các Lớp Học
              </h3>
              <div
                className="table-container"
                style={{ border: "none", boxShadow: "none" }}
              >
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Mã Lớp</th>
                      <th>Tên Lớp</th>
                      <th>Sĩ Số</th>
                      <th>Điểm TB Lớp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classes.map((cls) => (
                      <tr key={cls.ID}>
                        <td>
                          <span className="badge badge-class">{cls.MaLop}</span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{cls.TenLop}</td>
                        <td>{cls.SoLuongSinhVien} SV</td>
                        <td>
                          <span className="score-pill">
                            {cls.DiemTBLop.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* -------------------------------------------------------------
          TAB 2: QUẢN LÝ SINH VIÊN
      ------------------------------------------------------------- */}
      {activeTab === "students" && (
        <>
          <div className="action-toolbar">
            <div className="search-filter-group">
              <div className="search-input-box">
                <Search size={18} />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Tìm kiếm theo tên, mã lớp..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <select
                className="filter-select"
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
              >
                <option value="">-- Tất cả lớp học --</option>
                {classes.map((cls) => (
                  <option key={cls.ID} value={cls.MaLop}>
                    {cls.MaLop} - {cls.TenLop}
                  </option>
                ))}
              </select>

              <select
                className="filter-select"
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, ord] = e.target.value.split("-");
                  setSortBy(field);
                  setSortOrder(ord);
                }}
              >
                <option value="HoTen-ASC">Sắp xếp: Tên (A-Z)</option>
                <option value="HoTen-DESC">Sắp xếp: Tên (Z-A)</option>
                <option value="DiemTB-DESC">Sắp xếp: Điểm TB cao nhất</option>
                <option value="DiemTB-ASC">Sắp xếp: Điểm TB thấp nhất</option>
                <option value="NgaySinh-DESC">
                  Sắp xếp: Ngày sinh mới nhất
                </option>
              </select>
            </div>

            <button
              className="btn-primary"
              onClick={() => handleOpenStudentModal()}
            >
              <Plus size={18} />
              <span>Thêm Sinh Viên</span>
            </button>
          </div>

          <div className="table-container">
            {students.length === 0 ? (
              <div className="empty-state">
                <Users size={48} />
                <p>
                  Không tìm thấy sinh viên nào phù hợp với điều kiện tìm kiếm.
                </p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th># ID</th>
                    <th>Họ và Tên</th>
                    <th>Lớp Học</th>
                    <th>Ngày Sinh</th>
                    <th>Điểm TB</th>
                    <th>Xếp Loại</th>
                    <th style={{ textAlign: "right" }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((sv) => (
                    <tr key={sv.ID}>
                      <td style={{ color: "var(--gray-500)", fontWeight: 600 }}>
                        #{sv.ID}
                      </td>
                      <td>
                        <div className="user-cell">
                          <div className="avatar-initial">
                            {sv.HoTen.charAt(0)}
                          </div>
                          <div>
                            <div className="user-name">{sv.HoTen}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-class">
                          {sv.MaLop} - {sv.TenLop}
                        </span>
                      </td>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <Calendar size={14} color="var(--gray-400)" />
                          <span>{formatDate(sv.NgaySinh)}</span>
                        </div>
                      </td>
                      <td>
                        <span className="score-pill">
                          {Number(sv.DiemTB).toFixed(2)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${getRankBadgeClass(sv.XepLoai)}`}
                        >
                          {sv.XepLoai}
                        </span>
                      </td>
                      <td>
                        <div
                          className="action-cell"
                          style={{ justifyContent: "flex-end" }}
                        >
                          <button
                            className="btn-icon edit"
                            title="Sửa thông tin"
                            onClick={() => handleOpenStudentModal(sv)}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            className="btn-icon delete"
                            title="Xóa sinh viên"
                            onClick={() =>
                              setDeleteModal({
                                open: true,
                                type: "student",
                                item: sv,
                              })
                            }
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* -------------------------------------------------------------
          TAB 3: QUẢN LÝ LỚP HỌC
      ------------------------------------------------------------- */}
      {activeTab === "classes" && (
        <>
          <div className="action-toolbar">
            <div>
              <h2
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "var(--gray-800)",
                }}
              >
                Danh Sách Lớp Học ({classes.length} Lớp)
              </h2>
            </div>
            <button
              className="btn-primary"
              onClick={() => handleOpenClassModal()}
            >
              <Plus size={18} />
              <span>Thêm Lớp Học Mới</span>
            </button>
          </div>

          <div className="class-grid">
            {classes.map((cls) => (
              <div className="class-card" key={cls.ID}>
                <div className="class-card-header">
                  <div>
                    <span className="class-code">{cls.MaLop}</span>
                    <h3 className="class-name">{cls.TenLop}</h3>
                  </div>
                </div>

                <div className="class-card-stats">
                  <div className="class-stat-item">
                    <div className="label">Sĩ Số Sinh Viên</div>
                    <div className="val">{cls.SoLuongSinhVien} SV</div>
                  </div>
                  <div className="class-stat-item">
                    <div className="label">Điểm TB Của Lớp</div>
                    <div className="val">{cls.DiemTBLop.toFixed(2)}</div>
                  </div>
                </div>

                <div className="class-card-actions">
                  <button
                    className="btn-secondary"
                    style={{ padding: "6px 12px", fontSize: "13px" }}
                    onClick={() => handleOpenClassModal(cls)}
                  >
                    <Edit2 size={14} />
                    <span>Sửa</span>
                  </button>
                  <button
                    className="btn-secondary"
                    style={{
                      padding: "6px 12px",
                      fontSize: "13px",
                      color: "var(--danger)",
                    }}
                    onClick={() =>
                      setDeleteModal({ open: true, type: "class", item: cls })
                    }
                  >
                    <Trash2 size={14} />
                    <span>Xóa</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* -------------------------------------------------------------
          MODAL: THÊM / SỬA SINH VIÊN
      ------------------------------------------------------------- */}
      {studentModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setStudentModalOpen(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                <GraduationCap size={20} color="var(--primary)" />
                {studentFormData.ID
                  ? "Chỉnh Sửa Sinh Viên"
                  : "Thêm Sinh Viên Mới"}
              </h3>
              <button
                className="modal-close-btn"
                onClick={() => setStudentModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveStudent}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">
                    Họ và Tên <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ví dụ: Nguyễn Văn An"
                    required
                    value={studentFormData.HoTen}
                    onChange={(e) =>
                      setStudentFormData({
                        ...studentFormData,
                        HoTen: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Lớp Học <span className="required">*</span>
                  </label>
                  <select
                    className="form-select"
                    required
                    value={studentFormData.MaLop}
                    onChange={(e) =>
                      setStudentFormData({
                        ...studentFormData,
                        MaLop: e.target.value,
                      })
                    }
                  >
                    <option value="">-- Chọn lớp học --</option>
                    {classes.map((cls) => (
                      <option key={cls.ID} value={cls.MaLop}>
                        {cls.MaLop} - {cls.TenLop}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Điểm Trung Bình (0.00 - 10.00){" "}
                    <span className="required">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    className="form-input"
                    placeholder="Ví dụ: 8.50"
                    required
                    value={studentFormData.DiemTB}
                    onChange={(e) =>
                      setStudentFormData({
                        ...studentFormData,
                        DiemTB: e.target.value,
                      })
                    }
                  />
                  {studentFormData.DiemTB !== "" &&
                    !isNaN(studentFormData.DiemTB) && (
                      <span className="form-input-help">
                        Dự kiến xếp loại:{" "}
                        <strong>
                          {studentFormData.DiemTB >= 9.0
                            ? "Xuất sắc"
                            : studentFormData.DiemTB >= 8.0
                              ? "Giỏi"
                              : studentFormData.DiemTB >= 6.5
                                ? "Khá"
                                : studentFormData.DiemTB >= 5.0
                                  ? "Trung bình"
                                  : "Yếu"}
                        </strong>
                      </span>
                    )}
                </div>

                <div className="form-group">
                  <label className="form-label">Ngày Sinh</label>
                  <input
                    type="date"
                    className="form-input"
                    value={studentFormData.NgaySinh}
                    onChange={(e) =>
                      setStudentFormData({
                        ...studentFormData,
                        NgaySinh: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setStudentModalOpen(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="btn-primary">
                  {studentFormData.ID ? "Lưu Thay Đổi" : "Tạo Sinh Viên"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          MODAL: THÊM / SỬA LỚP HỌC
      ------------------------------------------------------------- */}
      {classModalOpen && (
        <div className="modal-overlay" onClick={() => setClassModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                <School size={20} color="var(--primary)" />
                {classFormData.ID ? "Chỉnh Sửa Lớp Học" : "Thêm Lớp Học Mới"}
              </h3>
              <button
                className="modal-close-btn"
                onClick={() => setClassModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveClass}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">
                    Mã Lớp (UNIQUE) <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ví dụ: CNTT01, KTPM02..."
                    required
                    value={classFormData.MaLop}
                    onChange={(e) =>
                      setClassFormData({
                        ...classFormData,
                        MaLop: e.target.value.toUpperCase(),
                      })
                    }
                  />
                  <span className="form-input-help">
                    Mã định danh duy nhất (ON UPDATE CASCADE sẽ tự cập nhật sinh
                    viên thuộc lớp).
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Tên Lớp Học <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ví dụ: Công nghệ Thông tin 01"
                    required
                    value={classFormData.TenLop}
                    onChange={(e) =>
                      setClassFormData({
                        ...classFormData,
                        TenLop: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setClassModalOpen(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="btn-primary">
                  {classFormData.ID ? "Lưu Thay Đổi" : "Tạo Lớp Học"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          MODAL: XÁC NHẬN XÓA
      ------------------------------------------------------------- */}
      {deleteModal.open && deleteModal.item && (
        <div
          className="modal-overlay"
          onClick={() =>
            setDeleteModal({ open: false, type: null, item: null })
          }
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-box">
              <div className="confirm-icon-box">
                <AlertTriangle size={32} />
              </div>
              <h3 className="confirm-title">
                {deleteModal.type === "student"
                  ? "Xác Nhận Xóa Sinh Viên?"
                  : "Xác Nhận Xóa Lớp Học?"}
              </h3>
              <p className="confirm-desc">
                {deleteModal.type === "student" ? (
                  <>
                    Bạn có chắc chắn muốn xóa sinh viên{" "}
                    <strong>"{deleteModal.item.HoTen}"</strong> (Mã SV: #
                    {deleteModal.item.ID}) khỏi hệ thống? Hành động này không
                    thể hoàn tác.
                  </>
                ) : (
                  <>
                    Bạn có chắc chắn muốn xóa lớp học{" "}
                    <strong>"{deleteModal.item.TenLop}"</strong> (
                    {deleteModal.item.MaLop})?
                    {deleteModal.item.SoLuongSinhVien > 0 && (
                      <span
                        style={{
                          display: "block",
                          color: "var(--danger)",
                          marginTop: "8px",
                          fontWeight: 600,
                        }}
                      >
                        ⚠️ Cảnh báo: Lớp hiện đang có{" "}
                        {deleteModal.item.SoLuongSinhVien} sinh viên. Bạn cần
                        chuyển hoặc xóa sinh viên trước khi xóa lớp!
                      </span>
                    )}
                  </>
                )}
              </p>
              <div style={{ display: "flex", gap: "12px", marginTop: "10px" }}>
                <button
                  className="btn-secondary"
                  onClick={() =>
                    setDeleteModal({ open: false, type: null, item: null })
                  }
                >
                  Hủy Bỏ
                </button>
                <button className="btn-danger" onClick={handleConfirmDelete}>
                  Xác Nhận Xóa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
