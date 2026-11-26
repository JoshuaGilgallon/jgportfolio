import Link from "next/link";
import { ChevronLeft, ChevronRight } from "./icons";
import s from "./text-link.module.css";

export function TextLink({
  href,
  children,
  back = false,
}: {
  href: string;
  children: React.ReactNode;
  back?: boolean;
}) {
  return (
    <Link href={href} className={`${s.link} ${back ? s.back : ""}`}>
      {back && <ChevronLeft className={s.icon} />}
      {children}
      {!back && <ChevronRight className={s.icon} />}
    </Link>
  );
}
