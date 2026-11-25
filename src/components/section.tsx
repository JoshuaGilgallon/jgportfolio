import s from "./section.module.css";

export function Section({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={s.section}>
      <div className={s.head}>
        <h2 id={`${id}-title`} className={s.title}>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
