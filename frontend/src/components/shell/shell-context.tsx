"use client";

import { createContext, use } from "react";

export interface ShellValue {
  leftOpen: boolean;
  setLeftOpen: (open: boolean) => void;
  membersOpen: boolean;
  setMembersOpen: (open: boolean) => void;
  openSwitcher: () => void;
  openAddCourse: () => void;
  openCreateLobby: (courseId: string) => void;
}

export const ShellContext = createContext<ShellValue | null>(null);

export function useShell(): ShellValue {
  const value = use(ShellContext);
  if (!value) throw new Error("useShell must be used inside AppShell");
  return value;
}
