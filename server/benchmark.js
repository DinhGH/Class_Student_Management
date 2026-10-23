/**
 * Script đo lường và so sánh hiệu năng API bằng Autocannon
 * (Theo đề bài của Thầy: Hàm X wait 1 giây)
 * 1. KHÔNG CACHE - ĐỒNG BỘ TUẦN TỰ: 3 hàm X x 1s = ~3 giây (3000ms)
 * 2. KHÔNG CACHE - BẤT ĐỒNG BỘ SONG SONG: 3 hàm X chạy song song bằng Promise.all = ~1 giây (1000ms)
 * 3. CÓ FULL-PAGE RESPONSE CACHE: Trả thẳng từ RAM = ~1 ms!
 */

const autocannon = require("autocannon");

const BASE_URL = "http://localhost:5000";
const CONNECTIONS = 10;
const DURATION = 6; // 6 giây mỗi lần đo (đủ cho nhiều chu kỳ 3s của Sync và 1s của Async)

function formatNumber(num) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(num));
}

function formatMs(ms) {
  return `${Number(ms).toFixed(2)} ms`;
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB/s`;
}

async function runBenchmark(name, url, headers = {}) {
  console.log(`\n⏳ Đang tiến hành đo: [${name}]`);
  console.log(`   URL: ${url}`);
  console.log(
    `   Số kết nối đồng thời: ${CONNECTIONS}, Thời gian đo: ${DURATION}s...`,
  );

  const result = await autocannon({
    url,
    connections: CONNECTIONS,
    duration: DURATION,
    headers,
    pipelining: 1,
  });

  return {
    name,
    requestsPerSec: result.requests.average,
    totalRequests: result.requests.total,
    latencyAvg: result.latency.average,
    latencyP50: result.latency.p50,
    latencyP99: result.latency.p99,
    latencyMax: result.latency.max,
    throughput: result.throughput.average,
    errors: result.errors,
    timeouts: result.timeouts,
  };
}

async function main() {
  console.log("=".repeat(85));
  console.log(
    "⚡ HỆ THỐNG ĐO LƯỜNG HIỆU NĂNG VỚI AUTOCANNON (MÔ HÌNH HÀM X WAIT 1 GIÂY) ⚡",
  );
  console.log("=".repeat(85));

  // 1. Kiểm tra kết nối đến server
  try {
    const health = await fetch(`${BASE_URL}/api/health`);
    const healthJson = await health.json();
    if (!healthJson.dbConnected) {
      console.error("❌ CSDL chưa kết nối! Vui lòng kiểm tra lại SQL Server.");
      process.exit(1);
    }
    console.log(
      "✅ Đã kết nối thành công đến Backend Server (http://localhost:5000)",
    );
  } catch (err) {
    console.error(
      "❌ Không thể kết nối tới Backend Server! Hãy đảm bảo server đã chạy (node index.js).",
    );
    process.exit(1);
  }

  // 2. Mồi cache (Warm up Full-Page Cache)
  console.log("\n🔥 Đang nạp trang vào Full-Page Cache...");
  await fetch(`${BASE_URL}/api/stats/clear-cache`, { method: "POST" });
  const warmRes = await fetch(`${BASE_URL}/api/stats`);
  const cacheHeader = warmRes.headers.get("x-cache");
  console.log(
    `   Lần gọi đầu tiên (Cache MISS -> Chạy ~1s và Lưu trang vào RAM): X-Cache = ${cacheHeader}`,
  );

  const checkHit = await fetch(`${BASE_URL}/api/stats`);
  console.log(
    `   Lần gọi thứ hai (Cache HIT -> Đọc từ RAM ~1ms): X-Cache = ${checkHit.headers.get("x-cache")}`,
  );

  // 3. Tiến hành benchmark 3 kịch bản
  const results = [];

  // Kịch bản 1: Không cache, chạy tuần tự đồng bộ (3 hàm X x 1s = ~3s)
  results.push(
    await runBenchmark(
      "1. Không Cache - ĐỒNG BỘ TUẦN TỰ (Sync ~3s)",
      `${BASE_URL}/api/stats-sync`,
    ),
  );

  // Kịch bản 2: Không cache, chạy bất đồng bộ song song (3 hàm X song song = ~1s)
  results.push(
    await runBenchmark(
      "2. Không Cache - BẤT ĐỒNG BỘ SONG SONG (Async ~1s)",
      `${BASE_URL}/api/stats-async`,
    ),
  );

  // Kịch bản 3: Có Full-Page Response Cache (Tầng Express Middleware)
  results.push(
    await runBenchmark(
      "3. CÓ FULL-PAGE RESPONSE CACHE (Cache HIT ~1ms)",
      `${BASE_URL}/api/stats`,
    ),
  );

  // 4. In bảng so sánh
  console.log("\n" + "=".repeat(85));
  console.log("📊 BẢNG TỔNG HỢP SO SÁNH KẾT QUẢ ĐO LƯỜNG BẰNG AUTOCANNON");
  console.log("=".repeat(85));

  const tableData = results.map((r) => ({
    "Kịch Bản Thử Nghiệm": r.name,
    "Yêu cầu/giây (RPS)": `${formatNumber(r.requestsPerSec)} req/s`,
    "Tổng Requests": formatNumber(r.totalRequests),
    "Độ trễ TB (Latency)": formatMs(r.latencyAvg),
    "Độ trễ p99": formatMs(r.latencyP99),
    Throughput: formatBytes(r.throughput),
  }));

  console.table(tableData);

  // 5. Phân tích chi tiết cho người dùng báo cáo thầy cô
  const syncRps = results[0].requestsPerSec || 1;
  const asyncRps = results[1].requestsPerSec;
  const cacheRps = results[2].requestsPerSec;

  const asyncSpeedup = (asyncRps / syncRps).toFixed(1);
  const cacheSpeedup = (cacheRps / syncRps).toFixed(0);

  console.log(
    "\n📝 PHÂN TÍCH & KẾT LUẬN CHO BÁO CÁO (ĐÚNG THEO ĐỀ BÀI CỦA THẦY):",
  );
  console.log("-".repeat(85));
  console.log(
    `1. SO SÁNH BẤT ĐỒNG BỘ (ASYNC) VS ĐỒNG BỘ (SYNC) VỚI HÀM X WAIT 1S:`,
  );
  console.log(
    `   - Đồng bộ (Sync): Gọi 3 lần hàm X tuần tự -> Mỗi request tốn: ~3.000 ms (${formatMs(results[0].latencyAvg)})`,
  );
  console.log(
    `   - Bất đồng bộ (Async): Gọi 3 hàm X song song bằng Promise.all -> Mỗi request tốn: ~1.000 ms (${formatMs(results[1].latencyAvg)})`,
  );
  console.log(
    `   => Bất đồng bộ nhanh hơn gấp ~${asyncSpeedup} LẦN so với đồng bộ (${formatNumber(asyncRps)} req/s vs ${formatNumber(syncRps)} req/s).`,
  );
  console.log(`\n2. SO SÁNH CÓ CACHE (FULL-PAGE CACHE) VS KHÔNG CACHE:`);
  console.log(
    `   - Không Cache: Mỗi request bắt buộc phải chờ 1s hoặc 3s để tính toán.`,
  );
  console.log(
    `   - Có Full-Page Cache: Middleware trả ngay trang từ RAM trong ${formatMs(results[2].latencyAvg)}!`,
  );
  console.log(
    `   => Có Cache tăng tốc độ xử lý gấp ~${cacheSpeedup} LẦN (${formatNumber(cacheRps)} req/s vs ${formatNumber(syncRps)} req/s).`,
  );
  console.log("=".repeat(85) + "\n");
}

main().catch(console.error);
