// server/index.ts (ตัวอย่างโครงสร้าง)
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { redisClient } from "./redisClient"; // Client Redis ที่สร้างไว้
import dotenv from "dotenv";

dotenv.config();

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000", // อนุญาต Frontend
    methods: ["GET", "POST"],
  },
});

const VENTERS_QUEUE = "venters_waiting";
const LISTENERS_QUEUE = "listeners_waiting";
const SOCKET_ROOM_MAP = "socket_room_map"; // เก็บว่า socket ไหนอยู่ห้องไหน

io.on("connection", (socket: Socket) => {
  console.log("A user connected:", socket.id);

  socket.on("find_match", async ({ role }: { role: "venter" | "listener" }) => {
    console.log(`User ${socket.id} looking for match as ${role}`);
    socket.data.role = role; // เก็บ role ไว้กับ socket instance

    const searchingQueue = role === "venter" ? LISTENERS_QUEUE : VENTERS_QUEUE;
    const waitingQueue = role === "venter" ? VENTERS_QUEUE : LISTENERS_QUEUE;

    try {
      // 1. ตรวจสอบว่าตัวเองอยู่ในคิวรออื่นหรือห้องอื่นอยู่แล้วหรือไม่ (ป้องกันการกดซ้ำ)
      const currentRoom = await redisClient.hget(SOCKET_ROOM_MAP, socket.id);
      if (currentRoom) {
        console.log(`User ${socket.id} is already in room ${currentRoom}`);
        // อาจจะแจ้งเตือนผู้ใช้ หรือไม่ต้องทำอะไร
        return;
      }
      // ลบตัวเองออกจากคิวรอก่อนหน้า ถ้ามี
      await redisClient.srem(VENTERS_QUEUE, socket.id);
      await redisClient.srem(LISTENERS_QUEUE, socket.id);

      // 2. หาคู่ใน Queue ตรงข้าม
      const partnerSocketId = await redisClient.spop(searchingQueue); // SPOP ดึงและลบสมาชิกแบบสุ่ม

      if (partnerSocketId) {
        // --- เจอคู่ ---
        const partnerSocket = io.sockets.sockets.get(partnerSocketId);
        if (!partnerSocket) {
          // ถ้า Socket ของ partner หายไป (อาจจะ disconnect ไปแล้ว) ให้ตัวเองกลับไปรอคิว
          console.log(
            `Partner ${partnerSocketId} not found, putting ${socket.id} back to wait`
          );
          await redisClient.sadd(waitingQueue, socket.id);
          socket.emit("waiting_for_match");
          return;
        }

        const roomId = `room-${socket.id}-${partnerSocketId}`;
        console.log(
          `Match found! Room: ${roomId}, Venter: ${
            role === "venter" ? socket.id : partnerSocketId
          }, Listener: ${role === "listener" ? socket.id : partnerSocketId}`
        );

        // 3. ให้ทั้งคู่ Join Socket.IO Room
        socket.join(roomId);
        partnerSocket.join(roomId);

        // 4. เก็บข้อมูลการจับคู่ใน Redis (มีประโยชน์ตอน disconnect)
        await redisClient.hset(SOCKET_ROOM_MAP, socket.id, roomId);
        await redisClient.hset(SOCKET_ROOM_MAP, partnerSocketId, roomId);
        // อาจจะเก็บข้อมูลห้องเพิ่มเติม เช่น room:{roomId}:venter = xxx, room:{roomId}:listener = yyy

        // 5. แจ้งทั้งคู่ว่าเจอแล้ว
        socket.emit("match_found", {
          roomId,
          partnerRole: partnerSocket.data.role,
        });
        partnerSocket.emit("match_found", {
          roomId,
          partnerRole: socket.data.role,
        });
      } else {
        // --- ไม่เจอคู่ ---
        console.log(
          `No match found for ${socket.id}, adding to ${waitingQueue}`
        );
        // 6. เพิ่มตัวเองเข้า Queue รอ
        await redisClient.sadd(waitingQueue, socket.id);
        socket.emit("waiting_for_match");
      }
    } catch (error) {
      console.error("Error finding match:", error);
      socket.emit("match_error", { message: "เกิดข้อผิดพลาดในการค้นหาคู่" });
      // อาจจะต้อง cleanup ถ้าเกิด error กลางคัน
      await redisClient.srem(VENTERS_QUEUE, socket.id);
      await redisClient.srem(LISTENERS_QUEUE, socket.id);
    }
  });

  socket.on(
    "send_message",
    async ({ roomId, message }: { roomId: string; message: string }) => {
        try {
            const currentRoom = await redisClient.hget(SOCKET_ROOM_MAP, socket.id);
            console.log(`[Send Msg] User ${socket.id} in room check: ${currentRoom}, Target room: ${roomId}`); // <--- เพิ่ม
            if (currentRoom !== roomId) {
                console.log(`[Send Msg] User ${socket.id} not in room ${roomId}.`); // <--- เพิ่ม
                return;
            }
        
            const payload = { // <--- สร้าง payload แยก
                senderId: socket.id,
                senderRole: socket.data.role,
                message: message,
            };
            console.log(`[Send Msg] Emitting 'receive_message' to room ${roomId} (except sender ${socket.id}) with payload:`, payload); // <--- เพิ่ม
            socket.to(roomId).emit('receive_message', payload); // <--- ส่ง payload
            console.log(`[Send Msg] Emission attempt finished for room ${roomId}`); // <--- เพิ่ม
        } catch (error) {
            console.error("[Send Msg] Error sending message:", error); // <--- เพิ่ม context
        }
    }
  );

  socket.on("leave_room", async () => {
    await handleDisconnect(socket); // ใช้ logic เดียวกับ disconnect
  });

  socket.on("disconnect", async (reason: string) => {
    console.log(`User ${socket.id} disconnected. Reason: ${reason}`);
    await handleDisconnect(socket);
  });
});

async function handleDisconnect(socket: Socket) {
  console.log(`Handling cleanup for ${socket.id}`);
  try {
    // 1. ตรวจสอบว่าอยู่ในห้องไหน
    const roomId = await redisClient.hget(SOCKET_ROOM_MAP, socket.id);

    if (roomId) {
      // --- ถ้าอยู่ในห้อง ---
      console.log(
        `Socket ${socket.id} was in room ${roomId}. Notifying partner.`
      );
      // แจ้ง partner ในห้อง
      socket.to(roomId).emit("partner_left");

      // หา partner socket id
      const socketsInRoom = await io.in(roomId).fetchSockets();
      socketsInRoom.forEach(async (partnerSocket) => {
        if (partnerSocket.id !== socket.id) {
          // ลบข้อมูลห้องของ partner ออกจาก Redis map
          await redisClient.hdel(SOCKET_ROOM_MAP, partnerSocket.id);
          partnerSocket.leave(roomId); // ให้ partner ออกจากห้องด้วย
          console.log(
            `Removed partner ${partnerSocket.id} from room map and forced leave.`
          );
        }
      });

      // ลบข้อมูลห้องของตัวเองออกจาก Redis map
      await redisClient.hdel(SOCKET_ROOM_MAP, socket.id);
      // อาจจะลบข้อมูลห้องอื่นๆ ที่เกี่ยวกับ roomId นี้ด้วย
      // await redisClient.del(`room:${roomId}:venter`, `room:${roomId}:listener`);
    } else {
      // --- ถ้าไม่ได้อยู่ในห้อง (อาจจะกำลังรอคิว) ---
      console.log(
        `Socket ${socket.id} was not in a room. Removing from queues.`
      );
      // ลบออกจาก Queue ทั้งสอง (เผื่อกรณีเปลี่ยนใจกดสลับไปมา)
      const removedVenter = await redisClient.srem(VENTERS_QUEUE, socket.id);
      const removedListener = await redisClient.srem(
        LISTENERS_QUEUE,
        socket.id
      );
      if (removedVenter || removedListener) {
        console.log(`Removed ${socket.id} from waiting queues.`);
      }
    }
    // Socket.IO จะจัดการให้ socket ออกจาก room ทั้งหมดโดยอัตโนมัติเมื่อ disconnect
  } catch (error) {
    console.error(`Error handling disconnect for ${socket.id}:`, error);
  }
}

const PORT = process.env.SOCKET_IO_PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});
