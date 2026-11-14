/**
 * Full Page / Full HTTP Response Cache Middleware
 * Cache toàn bộ phản hồi HTTP (status, headers, body) ở tầng Middleware của Express.
 * Hỗ trợ Redis dùng chung (khi có REDIS_URL) để đồng bộ cache giữa nhiều Backend Server,
 * và tự động fallback về bộ nhớ RAM (in-memory) khi chạy local không có Redis.
 */

let Redis = null;
try {
  Redis = require("ioredis");
} catch {
  // ioredis chưa được cài đặt -> dùng in-memory fallback
}

const REDIS_PREFIX = "pagecache:";

class ResponseCache {
  constructor() {
    this.store = new Map();
    this.hits = 0;
    this.misses = 0;
    this.redis = null;

    if (process.env.REDIS_URL && Redis) {
      this.redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 2,
        retryStrategy: (times) => Math.min(times * 200, 3000),
      });
      this.redis.on("connect", () => {
        console.log("✅ Đã kết nối Redis Cache:", process.env.REDIS_URL);
      });
      this.redis.on("error", (err) => {
        console.error("⚠️ Lỗi kết nối Redis Cache:", err.message);
      });
    }
  }

  isRedisReady() {
    return Boolean(this.redis && this.redis.status === "ready");
  }

  // Tạo cache key dựa vào URL và phương thức HTTP
  generateKey(req) {
    return `${req.method}:${req.originalUrl || req.url}`;
  }

  // Xóa toàn bộ cache hoặc xóa theo tiền tố
  async invalidate(pattern = "") {
    let deleted = 0;

    if (this.isRedisReady()) {
      try {
        const rawKeys = await this.redis.keys(`${REDIS_PREFIX}*`);
        const matchingKeys = pattern
          ? rawKeys.filter((k) => k.slice(REDIS_PREFIX.length).includes(pattern))
          : rawKeys;

        if (matchingKeys.length > 0) {
          deleted = await this.redis.del(...matchingKeys);
        }
        console.log(
          `[Redis Cache Invalidation] Đã xóa ${deleted} trang${pattern ? ` khớp mẫu '${pattern}'` : ""}.`,
        );
        return deleted;
      } catch (err) {
        console.error("[Redis Cache Invalidation] Lỗi:", err.message);
      }
    }

    if (!pattern) {
      const count = this.store.size;
      this.store.clear();
      console.log(
        `[Cache Invalidation] Đã xóa toàn bộ ${count} trang trong cache.`,
      );
      return count;
    }

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
    return async (req, res, next) => {
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
      const now = Date.now();
      let cached = null;
      let usedRedis = false;

      if (this.isRedisReady()) {
        try {
          const raw = await this.redis.get(`${REDIS_PREFIX}${key}`);
          if (raw) {
            cached = JSON.parse(raw);
            usedRedis = true;
          }
        } catch (err) {
          console.error("[Redis Cache] Get error:", err.message);
        }
      }

      if (!cached) {
        const memCached = this.store.get(key);
        if (memCached && now < memCached.expiresAt) {
          cached = memCached;
        }
      }

      // Kiểm tra nếu cache còn hiệu lực
      if (cached && now < cached.expiresAt) {
        this.hits++;
        const remainingTTL = Math.max(
          0,
          Math.round((cached.expiresAt - now) / 1000),
        );

        res.setHeader("X-Cache", "HIT");
        res.setHeader(
          "X-Cache-Type",
          usedRedis ? "Full-Page-Redis" : "Full-Page-Memory",
        );
        res.setHeader("X-Cache-TTL-Remaining", `${remainingTTL}s`);
        res.setHeader("Cache-Control", `public, max-age=${remainingTTL}`);
        if (cached.contentType) {
          res.setHeader("Content-Type", cached.contentType);
        }

        return res.status(cached.statusCode).send(cached.body);
      }

      // Cache MISS: Chặn và ghi lại response khi controller hoàn thành
      this.misses++;
      const cacheBackendType = this.isRedisReady()
        ? "Full-Page-Redis"
        : "Full-Page-Memory";
      res.setHeader("X-Cache", "MISS");
      res.setHeader("X-Cache-Type", cacheBackendType);
      res.setHeader("Cache-Control", `public, max-age=${durationSeconds}`);

      const originalSend = res.send.bind(res);

      res.send = (body) => {
        // Chỉ lưu cache khi HTTP Status là 2xx
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const payload = {
            statusCode: res.statusCode,
            contentType:
              res.getHeader("content-type") ||
              "application/json; charset=utf-8",
            body: body,
            cachedAt: now,
            expiresAt: now + durationSeconds * 1000,
          };

          if (this.isRedisReady()) {
            this.redis
              .set(
                `${REDIS_PREFIX}${key}`,
                JSON.stringify(payload),
                "EX",
                durationSeconds,
              )
              .catch((err) =>
                console.error("[Redis Cache] Set error:", err.message),
              );
          } else {
            this.store.set(key, payload);
          }
        }
        return originalSend(body);
      };

      next();
    };
  }

  // Lấy thống kê cache
  async getStats() {
    let keys = Array.from(this.store.keys());
    let backend = "memory";

    if (this.isRedisReady()) {
      try {
        const rawKeys = await this.redis.keys(`${REDIS_PREFIX}*`);
        keys = rawKeys.map((k) => k.slice(REDIS_PREFIX.length));
        backend = "redis";
      } catch (err) {
        console.error("[Redis Cache] Keys error:", err.message);
      }
    }

    return {
      backend,
      totalKeys: keys.length,
      keys,
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
