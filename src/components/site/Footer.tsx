import { Link } from "@tanstack/react-router";
import brandLogo from "@/assets/etqan-logo.png";
import { useI18n } from "@/lib/i18n";

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="site-footer mt-20 overflow-hidden bg-ink text-ink-foreground">
      <div className="site-footer__rings site-footer__rings--start" aria-hidden="true" />
      <div className="site-footer__rings site-footer__rings--end" aria-hidden="true" />
      <div className="site-footer__content mx-auto flex max-w-6xl flex-col items-center px-4 py-8 text-center sm:py-10">
        <div className="site-footer__brand">
          <img src={brandLogo} alt={t("brand")} width={76} height={76} className="size-[4.75rem] object-contain" />
          <span>{t("brand")}</span>
        </div>
        <nav aria-label={t("quickLinks")} className="site-footer__nav mt-8">
          <Link to="/">{t("home")}</Link>
          <span aria-hidden="true">|</span>
          <Link to="/categories">{t("categories")}</Link>
          <span aria-hidden="true">|</span>
          <Link to="/auth" search={{ mode: "login" }}>
            {t("login")}
          </Link>
          <span aria-hidden="true">|</span>
          <Link to="/account" search={{ tab: "profile" }}>
            {t("profile")}
          </Link>
        </nav>
      </div>
      <div className="site-footer__legal mx-auto max-w-6xl px-4 py-5 text-center text-xs">
        © {new Date().getFullYear()} {t("brand")} — {t("footerRights")}
      </div>
    </footer>
  );
}
