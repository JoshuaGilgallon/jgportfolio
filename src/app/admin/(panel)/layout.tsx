import Link from "next/link";
import { Suspense } from "react";
import { AdminTabs } from "@/components/admin/tabs";
import { ArrowUpRight } from "@/components/icons";
import { logout } from "@/lib/admin/auth-actions";
import { contentTypeKeys, contentTypes } from "@/lib/admin/config";
import s from "@/components/admin/admin.module.css";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const tabs = contentTypeKeys.map((key) => ({ href: `/admin/${key}`, label: contentTypes[key].label }));
  return (
    <div className={s.shell}>
      <header className={s.bar}>
        <div className={`${s.page} ${s.barInner}`}>
          <span className={s.brand}>Admin</span>
          <div className={s.barActions}>
            <Link href="/" className={s.barLink}>
              View site <ArrowUpRight />
            </Link>
            <form action={logout}>
              <button type="submit" className={s.barLink}>
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className={s.page}>
        <Suspense fallback={<div className={s.tabsPlaceholder} />}>
          <AdminTabs tabs={tabs} />
        </Suspense>
        {children}
      </div>
    </div>
  );
}
