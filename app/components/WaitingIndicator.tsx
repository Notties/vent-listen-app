// app/components/WaitingIndicator.tsx
"use client";

import React from "react";

interface WaitingIndicatorProps {
  role: "venter" | "listener";
  onCancel: () => void; // Function สำหรับยกเลิกการรอ
}

const WaitingIndicator: React.FC<WaitingIndicatorProps> = ({
  role,
  onCancel,
}) => {
  const waitingText =
    role === "venter"
      ? 'กำลังค้นหา "ผู้รับฟัง"...'
      : 'กำลังค้นหา "ผู้ระบาย"...';

  return (
    <div className="flex flex-col items-center justify-center p-8 border rounded-lg shadow-md bg-white">
      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mb-4"></div>
      <p className="text-xl font-semibold text-gray-700 mb-4">{waitingText}</p>
      <p className="text-sm text-gray-500 mb-6">
        กรุณารอสักครู่ ระบบกำลังจับคู่ให้คุณ
      </p>
      <button
        onClick={onCancel}
        className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold transition duration-200 ease-in-out"
      >
        ยกเลิกการค้นหา
      </button>
    </div>
  );
};

export default WaitingIndicator;
