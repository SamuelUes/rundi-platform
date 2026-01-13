"use client";

import { ReactNode } from "react";
import { CmsAuthGuard } from "@/components/CmsAuthGuard";
import { Sidebar } from "@/components/layout/Sidebar";
import { themeColors } from "@/theme/colors";
import { layout as layoutTokens } from "@/theme/layout";

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <CmsAuthGuard requiredRole="admin">
      <div className={`flex min-h-screen ${themeColors.appBackground}`}>
        <Sidebar role="admin" />
        <main className={`flex-1 ${layoutTokens.pageContent}`}>{children}</main>
      </div>
    </CmsAuthGuard>
  );
}
