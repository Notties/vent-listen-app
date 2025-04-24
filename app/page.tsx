// app/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
// *** ตรวจสอบ/แก้ไข import path นี้ ***
import { socket } from "../app/lib/socket"; // ใช้ alias path ที่ถูกต้อง
import RoleSelector from "./components/RoleSelector";
import WaitingIndicator from "./components/WaitingIndicator";
import ChatInterface from "./components/ChatInterface";
// *** ตรวจสอบว่า import Type มาจากที่เดียวกับ ChatInterface ***
import { Message, UserRole } from "./types/index";

type AppState =
  | "idle"
  | "selecting"
  | "waiting"
  | "in_chat"
  | "error"
  | "partner_left";

export default function Home() {
  const [appState, setAppState] = useState<AppState>("selecting");
  const [myRole, setMyRole] = useState<UserRole | null>(null);
  const [partnerRole, setPartnerRole] = useState<UserRole | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // ---- Memoized Functions ----

  const resetToIdle = useCallback(() => {
    console.log("Resetting state to idle/selecting");
    setAppState("selecting");
    setMyRole(null);
    setPartnerRole(null);
    setRoomId(null);
    setMessages([]);
    // setErrorMsg(null); // อาจจะคง error message ไว้ให้ user เห็นก่อน
    setIsConnecting(false);
    // ไม่ควร disconnect socket ที่นี่ ให้ disconnect ตอนผู้ใช้กดออก หรือปิดหน้า
  }, []); // ใช้ setter functions เท่านั้น ไม่มี dependency ภายนอก

  // ---- Socket Event Handlers (Memoized) ----

  const onConnect = useCallback(() => {
    console.log("Socket connected successfully:", socket.id);
    setIsConnecting(false);
  }, []);

  const onDisconnect = useCallback(
    (reason: string) => {
      console.warn("Socket disconnected:", reason, "Current state:", appState);
      setIsConnecting(false);
      // ใช้ Functional Update ป้องกัน stale state
      setAppState((prevAppState) => {
        // ทำการ reset หรือแสดง error เฉพาะเมื่อ disconnect เกิดขึ้นตอนกำลังรอหรือแชทอยู่
        if (prevAppState === "in_chat" || prevAppState === "waiting") {
          setErrorMsg(`การเชื่อมต่อหลุด (${reason}). กรุณาลองใหม่อีกครั้ง`);
          resetToIdle(); // เรียก resetToIdle ที่ memoized แล้ว
          // หรือจะ return 'error' state แทนก็ได้
          return "error"; // หรือ 'selecting' ตามต้องการ
        }
        // ถ้า disconnect ตอน state อื่น (เช่น selecting, partner_left) ไม่ต้องทำอะไรเป็นพิเศษ
        return prevAppState;
      });
    },
    [appState, resetToIdle] // resetToIdle เป็น dependency เพราะถูกเรียกใช้
  );

  const onMatchFound = useCallback(
    ({
      roomId: receivedRoomId,
      partnerRole: receivedPartnerRole,
    }: {
      roomId: string;
      partnerRole: UserRole;
    }) => {
      console.log(
        `Match found! Room: ${receivedRoomId}, Partner is ${receivedPartnerRole}`
      );
      setRoomId(receivedRoomId);
      setPartnerRole(receivedPartnerRole);
      setMessages([
        {
          sender: "system",
          role: "system",
          text: "จับคู่สำเร็จ! เริ่มบทสนทนาได้เลย",
        },
      ]);
      setAppState("in_chat");
      setIsConnecting(false);
    },
    [] // ใช้ setters เท่านั้น
  );

  const onWaiting = useCallback(() => {
    console.log("Server acknowledged request, waiting for match...");
    setAppState("waiting");
    setIsConnecting(false); // Server ตอบกลับแล้ว ไม่ใช่กำลังเชื่อมต่อ
  }, []);

  const onReceiveMessage = useCallback(
    ({ senderRole, message }: { senderRole: UserRole; message: string }) => {
      console.log(
        `>>> EVENT RECEIVED: receive_message from ${senderRole} with message: ${message}`
      );
      setMessages((prevMessages) => [
        ...prevMessages,
        { sender: "partner", role: senderRole, text: message },
      ]);
    },
    [] // ใช้ setter เท่านั้น
  );

  const onPartnerLeft = useCallback(() => {
    console.log("Partner left the chat notification received.");
    setMessages((prevMessages) => [
      ...prevMessages,
      { sender: "system", role: "system", text: "คู่สนทนาออกจากห้องแล้ว" },
    ]);
    setAppState("partner_left");
    // เก็บบาง state ไว้เผื่อแสดงผล แต่เคลียร์ roomId, partnerRole
    setRoomId(null);
    setPartnerRole(null);
    // ไม่ต้อง disconnect socket ที่นี่ partner อีกฝั่งจัดการ disconnect ของเขาเอง
  }, []); // ใช้ setters เท่านั้น

  const onMatchError = useCallback(
    ({ message }: { message: string }) => {
      console.error("Match Error from server:", message);
      setErrorMsg(message || "เกิดข้อผิดพลาดในการค้นหาคู่ โปรดลองอีกครั้ง");
      if (socket.connected) {
        // ถ้ายังต่ออยู่ อาจจะแค่กลับไปหน้าเลือก ไม่ต้อง disconnect
        resetToIdle();
      } else {
        // ถ้า disconnect ไปแล้ว ก็ reset state
        resetToIdle();
      }
      setIsConnecting(false);
    },
    [resetToIdle] // เรียกใช้ resetToIdle
  );

  // ---- Main Effect for Socket Listeners ----

  useEffect(() => {
    console.log("Setting up socket listeners effect runs.");

    // ตรวจสอบว่า socket มี instance จริง ก่อน add listeners
    if (!socket) {
      console.error("Socket instance is not available!");
      return;
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("match_found", onMatchFound);
    socket.on("waiting_for_match", onWaiting);
    socket.on("receive_message", onReceiveMessage);
    socket.on("partner_left", onPartnerLeft);
    socket.on("match_error", onMatchError);

    // Cleanup function
    return () => {
      console.log(">>> CLEANING UP socket listeners effect <<<");
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("match_found", onMatchFound);
      socket.off("waiting_for_match", onWaiting);
      socket.off("receive_message", onReceiveMessage);
      socket.off("partner_left", onPartnerLeft);
      socket.off("match_error", onMatchError);
    };
  }, [
    // Dependencies ที่เป็น functions ต้องถูก memoized ด้วย useCallback
    onConnect,
    onDisconnect,
    onMatchFound,
    onWaiting,
    onReceiveMessage,
    onPartnerLeft,
    onMatchError,
  ]);

  // ---- Effect for Handling Window Close ---- (Optional but Recommended)
  useEffect(() => {
    const handleBeforeUnload = () => {
      // ส่ง event แจ้ง server ว่ากำลังจะปิด (ถ้ายังเชื่อมต่ออยู่)
      if (socket.connected && roomId) {
        console.log("Window closing, emitting leave_room event...");
        // ใช้ sendBeacon ถ้าต้องการความแน่นอนมากขึ้น แต่ emit ปกติก็ได้
        socket.emit("leave_room"); // บอกให้ Server cleanup
        socket.disconnect(); // อาจจะ disconnect เลย
      }
      // บาง Browser อาจต้องการให้ตั้งค่า returnValue เพื่อแสดง confirmation dialog
      // event.preventDefault();
      // event.returnValue = '';
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [roomId]); // Dependency คือ roomId เพื่อให้รู้ว่าอยู่ในห้องหรือไม่

  // ---- Action Handlers ----

  const handleRoleSelect = (role: UserRole) => {
    console.log(
      `Role selected: ${role}. Current socket state: connected=${socket.connected}, connecting=${socket.connect}`
    );
    setErrorMsg(null);
    setMyRole(role);
    setIsConnecting(true);
    setAppState("waiting");

    if (!socket.connected) {
      console.log("Socket not connected. Attempting to connect...");
      socket.connect(); // เชื่อมต่อถ้ายังไม่ได้เชื่อม หรือไม่ได้กำลังเชื่อมต่อ

      socket.once("connect", () => {
        console.log(
          `Socket connected within handler, emitting find_match as ${role}`
        );
        // ตรวจสอบอีกครั้งก่อน emit เผื่อ disconnect ทันที
        if (socket.connected) {
          socket.emit("find_match", { role });
        } else {
          console.warn("Socket disconnected immediately after connect event.");
          setErrorMsg("การเชื่อมต่อไม่เสถียร โปรดลองอีกครั้ง");
          resetToIdle();
        }
      });

      // Timeout เผื่อกรณี 'connect' event ไม่มา หรือ connect นานเกินไป
      const connectionTimeout = setTimeout(() => {
        if (!socket.connected) {
          console.error("Socket connection attempt timed out.");
          setErrorMsg(
            "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ (หมดเวลา) โปรดลองอีกครั้ง"
          );
          setIsConnecting(false); // ต้องหยุด loading
          setAppState("error"); // ไปหน้า error
          socket.disconnect(); // สั่ง disconnect ให้แน่ใจ
        }
      }, 10000); // 10 วินาที

      // Clear timeout ถ้า connect สำเร็จ (ทำใน onConnect handler)
      socket.once("connect", () => clearTimeout(connectionTimeout));
      // Clear timeout ถ้าเกิด error ก่อน connect สำเร็จ
      socket.once("connect_error", () => clearTimeout(connectionTimeout));
    } else if (socket.connected) {
      console.log(`Socket already connected, emitting find_match as ${role}`);
      socket.emit("find_match", { role });
    } else  {
      console.log(
        "Socket is currently connecting, waiting for 'connect' event..."
      );
      // รอให้ 'connect' event ใน socket.once ด้านบนทำงาน
    }
  };

  const handleSendMessage = (message: string) => {
    const canSend = roomId && message && myRole && socket.connected;
    if (canSend) {
      console.log(
        `[Send Emit] Sending message to room ${roomId} from role ${myRole}: ${message}`
      );
      socket.emit("send_message", { roomId, message });
      setMessages((prevMessages) => [
        ...prevMessages,
        { sender: "me", role: myRole!, text: message },
      ]);
    } else {
      console.warn("[Send Emit] Cannot send message. Check conditions:", {
        roomId,
        message,
        myRoleSet: !!myRole,
        connected: socket.connected,
      });
      if (!socket.connected) {
        setErrorMsg("การเชื่อมต่อถูกตัด ไม่สามารถส่งข้อความได้");
        // อาจจะเปลี่ยน state เป็น error หรือแค่แสดงข้อความ
        setAppState("error"); // หรือ 'partner_left' ถ้ามั่นใจว่าหลุดเพราะ partner
      }
    }
  };

  const handleLeaveChat = () => {
    console.log("User initiated leave chat.");
    if (socket.connected) {
      console.log("Socket connected, emitting leave_room and disconnecting.");
      if (roomId) {
        socket.emit("leave_room"); // บอก server ให้ cleanup ห้อง
      }
      socket.disconnect(); // สั่ง disconnect client นี้
    } else {
      console.log("Socket already disconnected, just resetting state.");
    }
    // แสดงข้อความและ reset UI ทันที ไม่ต้องรอ server ตอบกลับ
    setMessages((prevMessages) => [
      ...prevMessages,
      { sender: "system", role: "system", text: "คุณออกจากห้องแล้ว" },
    ]);
    setTimeout(() => {
      // หน่วงเล็กน้อยให้เห็นข้อความก่อน reset state อื่นๆ
      resetToIdle();
    }, 500); // ลดเวลาหน่วงลง
  };

  const handleCancelWaiting = () => {
    console.log("User cancelled waiting.");
    if (socket.connected) {
      console.log("Socket connected, emitting leave_room and disconnecting.");
      // ไม่จำเป็นต้องส่ง roomId เพราะยังไม่ได้เข้าห้อง
      socket.emit("leave_room"); // บอก server ให้เอาออกจากคิว
      socket.disconnect();
    } else {
      console.log(
        "Socket already disconnected while waiting, just resetting state."
      );
    }
    resetToIdle(); // กลับหน้าเลือก role ทันที
  };

  const handleReturnToSelect = () => {
    resetToIdle();
  };

  // ---- Render Logic ----
  const renderContent = () => {
    // ... (ส่วน renderContent เหมือนเดิม ดูแล้วไม่น่ามีปัญหา) ...
    switch (appState) {
      case "selecting":
        return (
          <RoleSelector
            onSelectRole={handleRoleSelect}
            isLoading={isConnecting}
          />
        );
      case "waiting":
        return myRole ? (
          <WaitingIndicator role={myRole} onCancel={handleCancelWaiting} />
        ) : (
          // Fallback กรณี state ผิดพลาด
          <RoleSelector
            onSelectRole={handleRoleSelect}
            isLoading={isConnecting}
          />
        );
      case "in_chat":
        if (myRole && partnerRole && roomId) {
          return (
            <ChatInterface
              messages={messages}
              myRole={myRole}
              partnerRole={partnerRole}
              onSendMessage={handleSendMessage}
              onLeave={handleLeaveChat}
            />
          );
        }
        // ถ้า state ไม่ครบ กลับไปหน้าเลือก (ควร investigate ถ้าเกิดขึ้นบ่อย)
        console.error("Inconsistent state in 'in_chat', resetting.");
        resetToIdle();
        return (
          <RoleSelector
            onSelectRole={handleRoleSelect}
            isLoading={isConnecting}
          />
        );

      case "partner_left":
        // partnerRole อาจจะเป็น null แล้ว แต่ myRole ควรจะยังอยู่
        return (
          <div className="flex flex-col items-center space-y-4 p-8">
            {/* แสดง ChatInterface เดิม แต่ disable input/leave */}
            <ChatInterface
              messages={messages}
              myRole={myRole || "venter"} // ใส่ค่า default ถ้า myRole หายไป (ไม่ควรเกิด)
              partnerRole={partnerRole || "listener"} // แสดงเป็นค่า default ถ้า partnerRole เป็น null
              onSendMessage={() => {}}
              onLeave={() => {}}
            />
            <p className="text-red-600 font-semibold mt-4">
              คู่สนทนาของคุณออกจากห้องไปแล้ว
            </p>
            <button
              onClick={handleReturnToSelect}
              className="mt-4 px-6 py-2 rounded-lg bg-gray-500 hover:bg-gray-600 text-white font-semibold"
            >
              กลับหน้าหลัก
            </button>
          </div>
        );
      case "error":
      default:
        return (
          <div className="flex flex-col items-center space-y-4 p-8 text-center">
            <p className="text-red-600 font-semibold">เกิดข้อผิดพลาด:</p>
            <p className="text-gray-700 mb-4">
              {errorMsg || "มีบางอย่างผิดปกติ"}
            </p>
            <button
              onClick={handleReturnToSelect}
              className="mt-4 px-6 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-semibold"
            >
              ลองอีกครั้ง
            </button>
          </div>
        );
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
      <div className="container mx-auto max-w-3xl bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6">
        {/* แสดง Error Message ด้านบนเสมอ ถ้ามี */}
        {errorMsg && (
          <div
            className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4"
            role="alert"
          >
            <strong className="font-bold">ผิดพลาด: </strong>
            <span className="block sm:inline">{errorMsg}</span>
            <button
              className="absolute top-0 bottom-0 right-0 px-4 py-3 text-red-500 hover:text-red-700"
              onClick={() => setErrorMsg(null)} // ปุ่มปิด error เล็กๆ
              aria-label="Close"
            >
              X {/* หรือใช้ icon SVG */}
            </button>
          </div>
        )}
        {renderContent()}
      </div>
      <footer className="text-center text-xs text-gray-500 mt-8">
        Vent-Listen App | พื้นที่ปลอดภัยในการแบ่งปัน
      </footer>
    </main>
  );
}
