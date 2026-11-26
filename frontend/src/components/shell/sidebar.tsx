"use client";

import { useParams } from "next/navigation";
import { CourseSidebar } from "./course-sidebar";
import { HomeSidebar } from "./home-sidebar";
import { UserPanel } from "./user-panel";

export function Sidebar() {
  const { courseId } = useParams<{ courseId?: string }>();
  return (
    <aside aria-label="Panel navigasi" className="flex min-w-0 flex-1 flex-col border-r border-line bg-side sm:w-60 sm:flex-none">
      {courseId ? <CourseSidebar key={courseId} courseId={courseId} /> : <HomeSidebar />}
      <UserPanel />
    </aside>
  );
}
