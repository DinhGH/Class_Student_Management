const API_BASE = "/api";

async function handleResponse(response) {
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || "Có lỗi xảy ra khi xử lý yêu cầu");
  }
  return {
    ...data,
    _headers: {
      cache: response.headers.get("x-cache"),
      cacheType: response.headers.get("x-cache-type"),
      cacheTtl: response.headers.get("x-cache-ttl-remaining"),
    },
  };
}

export const api = {
  // Stats (Full Page Cache)
  async getStats(cache = true) {
    const t0 = performance.now();
    const url = cache ? `${API_BASE}/stats` : `${API_BASE}/stats?cache=false`;
    const res = await fetch(url);
    const result = await handleResponse(res);
    result._clientDurationMs = Number((performance.now() - t0).toFixed(2));
    return result;
  },

  // Stats (Sync Sequential)
  async getStatsSync() {
    const t0 = performance.now();
    const res = await fetch(`${API_BASE}/stats-sync`);
    const result = await handleResponse(res);
    result._clientDurationMs = Number((performance.now() - t0).toFixed(2));
    return result;
  },

  // Stats (Async Parallel)
  async getStatsAsync() {
    const t0 = performance.now();
    const res = await fetch(`${API_BASE}/stats-async`);
    const result = await handleResponse(res);
    result._clientDurationMs = Number((performance.now() - t0).toFixed(2));
    return result;
  },

  // Clear Cache
  async clearStatsCache() {
    const res = await fetch(`${API_BASE}/stats/clear-cache`, {
      method: "POST",
    });
    return handleResponse(res);
  },

  // Classes
  async getClasses() {
    const res = await fetch(`${API_BASE}/classes`);
    return handleResponse(res);
  },

  async createClass(classData) {
    const res = await fetch(`${API_BASE}/classes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(classData),
    });
    return handleResponse(res);
  },

  async updateClass(id, classData) {
    const res = await fetch(`${API_BASE}/classes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(classData),
    });
    return handleResponse(res);
  },

  async deleteClass(id) {
    const res = await fetch(`${API_BASE}/classes/${id}`, {
      method: "DELETE",
    });
    return handleResponse(res);
  },

  // Students
  async getStudents({
    search = "",
    maLop = "",
    sortBy = "HoTen",
    order = "ASC",
  } = {}) {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (maLop) params.append("maLop", maLop);
    if (sortBy) params.append("sortBy", sortBy);
    if (order) params.append("order", order);

    const res = await fetch(`${API_BASE}/students?${params.toString()}`);
    return handleResponse(res);
  },

  async createStudent(studentData) {
    const res = await fetch(`${API_BASE}/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(studentData),
    });
    return handleResponse(res);
  },

  async updateStudent(id, studentData) {
    const res = await fetch(`${API_BASE}/students/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(studentData),
    });
    return handleResponse(res);
  },

  async deleteStudent(id) {
    const res = await fetch(`${API_BASE}/students/${id}`, {
      method: "DELETE",
    });
    return handleResponse(res);
  },
};
