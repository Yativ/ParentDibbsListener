import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Bell, Shield, Users, Globe } from "lucide-react";
import { Language, useTranslation, getStoredLanguage, setStoredLanguage } from "@/lib/i18n";

export default function Landing() {
  const [lang, setLang] = useState<Language>(getStoredLanguage());
  const { t, isRTL } = useTranslation(lang);

  useEffect(() => {
    setStoredLanguage(lang);
    document.title = `${t("appName")} - ${t("appDescription")}`;
  }, [lang, t]);

  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  const toggleLanguage = () => {
    setLang(lang === "he" ? "en" : "he");
  };

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? "rtl" : "ltr"}>
      <div className="container mx-auto px-4 py-8">
        <header className="flex justify-between items-center mb-16 gap-4">
          <h1 className="text-2xl font-bold text-foreground">{t("appName")}</h1>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleLanguage}
              data-testid="button-language-toggle"
              title={lang === "he" ? "English" : "עברית"}
            >
              <Globe className="h-5 w-5" />
            </Button>
            <Button onClick={handleLogin} data-testid="button-login">
              {t("login")}
            </Button>
          </div>
        </header>

        <main className="max-w-4xl mx-auto text-center">
          <div className="mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              {t("landingTitle")}
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              {t("landingSubtitle")}
            </p>
            <Button size="lg" onClick={handleLogin} data-testid="button-get-started">
              {t("getStarted")}
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-16">
            <Card>
              <CardHeader>
                <MessageSquare className="h-10 w-10 text-primary mb-2" />
                <CardTitle>{t("groupMonitoring")}</CardTitle>
                <CardDescription>
                  {t("groupMonitoringDesc")}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Bell className="h-10 w-10 text-primary mb-2" />
                <CardTitle>{t("realTimeAlerts")}</CardTitle>
                <CardDescription>
                  {t("realTimeAlertsDesc")}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Shield className="h-10 w-10 text-primary mb-2" />
                <CardTitle>{t("securePrivate")}</CardTitle>
                <CardDescription>
                  {t("securePrivateDesc")}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Users className="h-10 w-10 text-primary mb-2" />
                <CardTitle>{t("multiUser")}</CardTitle>
                <CardDescription>
                  {t("multiUserDesc")}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          <div className="bg-muted rounded-lg p-8">
            <h3 className="text-2xl font-bold mb-4">{t("howItWorks")}</h3>
            <ol className={`${isRTL ? "text-right" : "text-left"} text-muted-foreground space-y-4 max-w-md mx-auto`}>
              <li className="flex items-start gap-3">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm shrink-0">1</span>
                <span>{t("step1")}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm shrink-0">2</span>
                <span>{t("step2")}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm shrink-0">3</span>
                <span>{t("step3")}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm shrink-0">4</span>
                <span>{t("step4")}</span>
              </li>
            </ol>
          </div>
        </main>

        <footer className="mt-16 text-center text-muted-foreground text-sm">
          <p>{t("copyright", { year: new Date().getFullYear(), appName: t("appName") })}</p>
        </footer>
      </div>
    </div>
  );
}
