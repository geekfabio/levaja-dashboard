import type { AdminRole, AdminSession, AdminUser } from "@/types/leva-ja";

export type CreateAdminUserInput = { name: string; email: string; role: AdminRole };

export interface AdminAuthRepository {
  requestCode(email: string): Promise<{ sentTo: string }>;
  login(email: string, code: string): Promise<AdminSession>;
  currentSession(): Promise<AdminSession | null>;
  logout(): Promise<void>;
  listUsers(): Promise<AdminUser[]>;
  createUser(input: CreateAdminUserInput, reason: string): Promise<AdminUser>;
  changeRole(userId: string, role: AdminRole, reason: string): Promise<AdminUser>;
  setActive(userId: string, active: boolean, reason: string): Promise<AdminUser>;
}
