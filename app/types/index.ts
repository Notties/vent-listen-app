// types/index.ts
export type UserRole = "venter" | "listener";

export interface Message {
  sender: "me" | "partner" | "system"; // ทำให้แน่ใจว่ารองรับ 'system'
  role: UserRole | "system";
  text: string;
}
