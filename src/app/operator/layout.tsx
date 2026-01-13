"use client";

import { ReactNode } from "react";
import { CmsAuthGuard } from "@/components/CmsAuthGuard";
import { Sidebar } from "@/components/layout/Sidebar";
import { themeColors } from "@/theme/colors";
import { layout as layoutTokens } from "@/theme/layout";

interface OperatorLayoutProps {
  children: ReactNode;
}

export default function OperatorLayout({ children }: OperatorLayoutProps) {
  return (
    <CmsAuthGuard requiredRole="operator">
      <div className={`flex min-h-screen ${themeColors.appBackground}`}>
        <Sidebar role="operator" />
        <main className={`flex-1 ${layoutTokens.pageContent}`}>{children}</main>
      </div>
    </CmsAuthGuard>
  );
}
