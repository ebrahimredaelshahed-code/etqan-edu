import { Link } from "@tanstack/react-router";
import { Mail, Phone } from "lucide-react";
import brandLogo from "@/assets/etqan-logo.png";
import { useI18n } from "@/lib/i18n";

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="mt-20 bg-ink text-ink-foreground">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-3">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-lg font-extrabold">
            <img src={brandLogo.url} alt={t("brand")} width={28} height={28} className="size-7 rounded-lg object-cover" /> {t("brand")}
          </div>
          <p className="max-w-xs text-sm opacity-70">{t("aboutText")}</p>
        </div>
        <div className="space-y-3">
          <h3 className="font-bold">{t("quickLinks")}</h3>
          <ul className="space-y-2 text-sm opacity-80">
            <li>
              <Link to="/">{t("home")}</Link>
            </li>
            <li>
              <Link to="/categories">{t("categories")}</Link>
            </li>
            <li>
              <Link to="/auth" search={{ mode: "login" }}>
                {t("login")}
              </Link>
            </li>
          </ul>
        </div>
        <div className="space-y-3">
          <h3 className="font-bold">{t("contact")}</h3>
          <ul className="space-y-2 text-sm opacity-80">
            <li className="flex items-center gap-2">
              <Phone className="size-4" /> 01000000000
            </li>
            <li className="flex items-center gap-2">
              <Mail className="size-4" /> support@etqan-academy.app
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs opacity-60">
        © {new Date().getFullYear()} {t("brand")} — {t("footerRights")}
      </div>
    </footer>
  );
}
