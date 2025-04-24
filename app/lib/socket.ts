// app/lib/socket.ts
import { io, Socket } from "socket.io-client";

// ใช้ URL จาก Environment Variable ที่กำหนดใน Next.js (ต้องขึ้นต้นด้วย NEXT_PUBLIC_)
const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_IO_URL || "http://localhost:3001"; // Default ถ้าไม่ได้ตั้งค่า

// สร้าง instance แต่ยังไม่เชื่อมต่อทันที
// `autoConnect: false` สำคัญมาก เราจะเชื่อมต่อเมื่อผู้ใช้กดค้นหา
export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnectionAttempts: 5, // ลองเชื่อมต่อใหม่ 5 ครั้ง
  reconnectionDelay: 3000, // รอ 3 วินาทีก่อนลองใหม่
});

// สามารถเพิ่ม event listeners สำหรับ debug ได้ที่นี่ (แต่อย่าลืมเอาออกใน production)
socket.on("connect", () => {
  console.log("Socket connected:", socket.id);
});

socket.on("disconnect", (reason) => {
  console.log("Socket disconnected:", reason);
  // อาจจะต้องจัดการ UI state ที่นี่หากการ disconnect ไม่คาดฝัน
});

socket.on("connect_error", (err) => {
  console.error("Socket connection error:", err.message);
  // แจ้งเตือนผู้ใช้ว่าเชื่อมต่อ Server ไม่ได้
});

// Export instance เพื่อนำไปใช้ใน component อื่นๆ
