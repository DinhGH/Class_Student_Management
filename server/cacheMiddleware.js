/**
 * Full Page / Full HTTP Response Cache Middleware
 * Cache toàn bộ phản hồi HTTP (status, headers, body) ở tầng Middleware của Express.
 * Khi có Cache HIT, Express trả về ngay lập tức nội dung trang/JSON từ bộ nhớ RAM
 * mà không cần phải thực thi controller hay bất kỳ truy vấn CSDL nào.
 */

class ResponseCache {
  constructor() {
    this.store = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  // Tạo cache key dựa vào URL và phương thức HTTP
  generateKey(req) {
    return `${req.method}:${req.originalUrl || req.url}`;
  }

  // Xóa toàn bộ cache hoặc xóa theo tiền tố
  invalidate(pattern = "") {
    if (!pattern) {
      const count = this.store.size;
      this.store.clear();
      console.log(
        `[Cache Invalidation] Đã xóa toàn bộ ${count} trang trong cache.`,
      );
      return count;
    }

    let deleted = 0;
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) {
        this.store.delete(key);
        deleted++;
      }
    }
    console.log(
      `[Cache Invalidation] Đã xóa ${deleted} trang khớp mẫu '${pattern}'.`,
    );
    return deleted;
  }

  // Middleware caching toàn bộ trang/response
  middleware(durationSeconds = 60) {
    return (req, res, next) => {
      // Chỉ cache cho các request GET
      if (req.method !== "GET") {
        return next();
      }

      // Hỗ trợ bỏ qua cache bằng query ?cache=false hoặc header Cache-Control: no-cache
      if (
        req.query.cache === "false" ||
        req.headers["cache-control"] === "no-cache"
      ) {
        res.setHeader("X-Cache", "BYPASS");
        return next();
      }

      const key = this.generateKey(req);
      const cached = this.store.get(key);
      const now = Date.now();

      // Kiểm tra nếu cache còn hiệu lực
      if (cached && now < cached.expiresAt) {
        this.hits++;
        const remainingTTL = Math.round((cached.expiresAt - now) / 1000);

        res.setHeader("X-Cache", "HIT");
        res.setHeader("X-Cache-Type", "Full-Page-Memory");
        res.setHeader("X-Cache-TTL-Remaining", `${remainingTTL}s`);
        res.setHeader("Cache-Control", `public, max-age=${remainingTTL}`);
        if (cached.contentType) {
          res.setHeader("Content-Type", cached.contentType);
        }

        return res.status(cached.statusCode).send(cached.body);
      }

      // Cache MISS: Chặn và ghi lại response khi controller hoàn thành
      this.misses++;
      res.setHeader("X-Cache", "MISS");
      res.setHeader("X-Cache-Type", "Full-Page-Memory");
      res.setHeader("Cache-Control", `public, max-age=${durationSeconds}`);

      const originalSend = res.send.bind(res);

      res.send = (body) => {
        // Chỉ lưu cache khi HTTP Status là 2xx
        if (res.statusCode >= 200 && res.statusCode < 300) {
          this.store.set(key, {
            statusCode: res.statusCode,
            contentType:
              res.getHeader("content-type") ||
              "application/json; charset=utf-8",
            body: body,
            cachedAt: now,
            expiresAt: now + durationSeconds * 1000,
          });
        }
        return originalSend(body);
      };

      next();
    };
  }

  // Lấy thống kê cache
  getStats() {
    return {
      totalKeys: this.store.size,
      keys: Array.from(this.store.keys()),
      hits: this.hits,
      misses: this.misses,
      hitRatio:
        this.hits + this.misses > 0
          ? `${((this.hits / (this.hits + this.misses)) * 100).toFixed(1)}%`
          : "0%",
    };
  }
}

const responseCache = new ResponseCache();

module.exports = {
  responseCache,
  pageCache: (ttl) => responseCache.middleware(ttl),
};
