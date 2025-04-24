// app/components/ChatInterface.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { Message } from "../types";

interface ChatInterfaceProps {
  messages: Message[];
  myRole: "venter" | "listener";
  partnerRole: "venter" | "listener";
  onSendMessage: (message: string) => void;
  onLeave: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  myRole,
  partnerRole,
  onSendMessage,
  onLeave,
}) => {
  const [currentMessage, setCurrentMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null); // Ref สำหรับ auto-scroll

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Auto-scroll เมื่อมีข้อความใหม่
  useEffect(scrollToBottom, [messages]);

  const handleSend = (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault(); // ป้องกันการ reload หน้า ถ้าใช้ form
    if (currentMessage.trim()) {
      onSendMessage(currentMessage.trim());
      setCurrentMessage("");
    }
  };

  const getRoleDisplayName = (
    role: "venter" | "listener" | "system"
  ): string => {
    if (role === "venter") return "ผู้ระบาย";
    if (role === "listener") return "ผู้รับฟัง";
    return "ระบบ";
  };

  return (
    <div className="flex flex-col h-[80vh] w-full max-w-2xl mx-auto bg-white shadow-xl rounded-lg border">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b bg-gray-50 rounded-t-lg">
        <div className="font-semibold">
          คุณ ({getRoleDisplayName(myRole)}){" "}
          <span className="text-gray-400 mx-2"></span>{" "}
          {getRoleDisplayName(partnerRole)}
        </div>
        <button
          onClick={onLeave}
          className="px-3 py-1 text-sm rounded bg-red-500 hover:bg-red-600 text-white font-semibold transition duration-200"
        >
          ออกจากห้อง
        </button>
      </div>

      {/* Message Area */}
      <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-gray-100">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${
              msg.sender === "me" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg shadow ${
                msg.sender === "me"
                  ? "bg-blue-500 text-white"
                  : msg.role === "system"
                  ? "bg-yellow-200 text-yellow-800 text-center w-full" // System message style
                  : "bg-white text-gray-800"
              }`}
            >
              {msg.role !== "system" && (
                <span className="text-xs font-semibold block mb-1 opacity-80">
                  {msg.sender === "me" ? "คุณ" : getRoleDisplayName(msg.role)}
                </span>
              )}
              {msg.text}
            </div>
          </div>
        ))}
        {/* Element สำหรับช่วย auto-scroll */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form
        onSubmit={handleSend}
        className="p-4 border-t flex space-x-2 bg-gray-50 rounded-b-lg"
      >
        <input
          type="text"
          value={currentMessage}
          onChange={(e) => setCurrentMessage(e.target.value)}
          placeholder="พิมพ์ข้อความของคุณ..."
          className="flex-grow px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          autoFocus // Focus ทันทีเมื่อเข้าห้อง
        />
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-semibold transition duration-200"
        >
          ส่ง
        </button>
      </form>
    </div>
  );
};

export default ChatInterface;
