import Link from "next/link";
import styles from "./AppShell.module.css";

interface Props {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function AppShell({ children, title, subtitle, action }: Props) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <Link href="/" className={styles.logo}>
            Log Lens
          </Link>
          {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
        </div>
        {title && <h1 className={styles.pageTitle}>{title}</h1>}
        {action && <div className={styles.action}>{action}</div>}
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
