import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Bell, Shield, Users } from "lucide-react";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto px-4 py-8">
        <header className="flex justify-between items-center mb-16">
          <h1 className="text-2xl font-bold text-foreground">כוננות קל</h1>
          <Button onClick={handleLogin} data-testid="button-login">
            התחברות
          </Button>
        </header>

        <main className="max-w-4xl mx-auto text-center">
          <div className="mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              ניטור קבוצות WhatsApp בזמן אמת
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              קבלו התראות פרטיות כאשר מילות מפתח מופיעות בקבוצות שלכם
            </p>
            <Button size="lg" onClick={handleLogin} data-testid="button-get-started">
              התחילו עכשיו - חינם
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-16">
            <Card>
              <CardHeader>
                <MessageSquare className="h-10 w-10 text-primary mb-2" />
                <CardTitle>ניטור קבוצות</CardTitle>
                <CardDescription>
                  בחרו קבוצות WhatsApp לניטור ומילות מפתח לחיפוש
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Bell className="h-10 w-10 text-primary mb-2" />
                <CardTitle>התראות בזמן אמת</CardTitle>
                <CardDescription>
                  קבלו הודעה פרטית ב-WhatsApp כאשר מזהים מילת מפתח
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Shield className="h-10 w-10 text-primary mb-2" />
                <CardTitle>מאובטח ופרטי</CardTitle>
                <CardDescription>
                  חיבור מאובטח - הנתונים שלכם נשארים רק אצלכם
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Users className="h-10 w-10 text-primary mb-2" />
                <CardTitle>רב-משתמשים</CardTitle>
                <CardDescription>
                  כל משתמש מחבר את ה-WhatsApp שלו ומקבל התראות משלו
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          <div className="bg-muted rounded-lg p-8">
            <h3 className="text-2xl font-bold mb-4">איך זה עובד?</h3>
            <ol className="text-right text-muted-foreground space-y-4 max-w-md mx-auto">
              <li className="flex items-start gap-3">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm shrink-0">1</span>
                <span>התחברו עם חשבון Google או אחר</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm shrink-0">2</span>
                <span>סרקו קוד QR לחיבור WhatsApp שלכם</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm shrink-0">3</span>
                <span>בחרו קבוצות והגדירו מילות מפתח</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm shrink-0">4</span>
                <span>קבלו התראות פרטיות ישירות ל-WhatsApp שלכם</span>
              </li>
            </ol>
          </div>
        </main>

        <footer className="mt-16 text-center text-muted-foreground text-sm">
          <p>© {new Date().getFullYear()} כוננות קל. כל הזכויות שמורות.</p>
        </footer>
      </div>
    </div>
  );
}
