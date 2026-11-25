"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import s from "./admin.module.css";

/** iOS-style segmented control used as the admin's section switcher. */
export function AdminTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Content" className={s.tabsWrap}>
      <ul className={`${s.tabs} sq`}>
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={`${s.tab} sq ${active ? s.tabActive : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
