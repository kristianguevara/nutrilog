import { Outlet } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav.js";

export function AppShell() {
  return (
    <>
      <Outlet />
      <BottomNav />
    </>
  );
}
