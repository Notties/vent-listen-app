// server/redisClient.ts
import Redis from "ioredis";
import dotenv from "dotenv";
import path from "path"; // <--- Import path module

// ระบุ path ไปยัง .env ใน root folder โดยอิงจากตำแหน่งปัจจุบัน (__dirname)
// __dirname จะเป็น path ของโฟลเดอร์ server (เช่น C:\...\vent-listen-app\server)
// ดังนั้นต้องถอยกลับไป 1 ระดับ ('../') เพื่อหา .env ใน root
const envPath = path.resolve(__dirname, "../.env");
console.log(`Attempting to load .env file from: ${envPath}`); // <--- เพิ่ม log เพื่อ debug

const result = dotenv.config({ path: envPath }); // <--- ระบุ path

if (result.error) {
  console.error("Error loading .env file:", result.error); // <--- เพิ่ม log error จาก dotenv
}
// console.log('Parsed .env content (if any):', result.parsed); // เอา comment ออกเพื่อดูค่าที่อ่านได้

const redisUrl = process.env.REDIS_URL;
console.log(`Value of REDIS_URL from process.env: ${redisUrl}`); // <--- เพิ่ม log ค่าที่อ่านได้

if (!redisUrl) {
  console.error(
    "Missing REDIS_URL environment variable after attempting load."
  ); // <--- ข้อความ error ที่ชัดเจนขึ้น
  console.error(
    "Check if the .env file exists at the specified path and contains the REDIS_URL variable."
  );
  console.error("Also check file permissions and encoding (should be UTF-8).");
  process.exit(1);
}

export const redisClient = new Redis(redisUrl, {
  // ป้องกันการพยายามเชื่อมต่อใหม่ตลอดไปหาก Redis ล่ม
  maxRetriesPerRequest: 3,
  enableOfflineQueue: false, // ไม่เก็บคำสั่งไว้รอถ้าเชื่อมต่อไม่ได้
});

redisClient.on("connect", () => {
  console.log("Connected to Redis");
});

redisClient.on("error", (err) => {
  console.error("Redis connection error:", err);
  // อาจจะเพิ่ม logic แจ้งเตือนหรือจัดการอื่นๆ ที่นี่
});
