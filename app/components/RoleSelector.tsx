// app/components/RoleSelector.tsx
"use client";

import React from "react";

interface RoleSelectorProps {
  onSelectRole: (role: "venter" | "listener") => void;
  isLoading: boolean; // รับสถานะ loading มาด้วย
}

const RoleSelector: React.FC<RoleSelectorProps> = ({
  onSelectRole,
  isLoading,
}) => {
  return (
    <div className="flex flex-col items-center space-y-4 p-8">
      <h1 className="text-2xl font-bold mb-6">เลือกบทบาทของคุณ</h1>
      <button
        onClick={() => onSelectRole("venter")}
        disabled={isLoading}
        className={`px-6 py-3 rounded-lg text-white font-semibold text-lg transition duration-200 ease-in-out ${
          isLoading
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-blue-500 hover:bg-blue-600"
        }`}
      >
        ฉันอยากระบาย
      </button>
      <button
        onClick={() => onSelectRole("listener")}
        disabled={isLoading}
        className={`px-6 py-3 rounded-lg text-white font-semibold text-lg transition duration-200 ease-in-out ${
          isLoading
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-green-500 hover:bg-green-600"
        }`}
      >
        ฉันพร้อมรับฟัง
      </button>
      {isLoading && <p className="mt-4 text-gray-600">กำลังดำเนินการ...</p>}
    </div>
  );
};

export default RoleSelector;
