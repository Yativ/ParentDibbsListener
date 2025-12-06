import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Users, Shield } from "lucide-react";
import { Link } from "wouter";
import type { User } from "@shared/schema";

export default function Admin() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const { data: users, isLoading: usersLoading, error } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAuthenticated && !!user,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "לא מורשה",
        description: "יש להתחבר כדי לגשת לדף זה",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  useEffect(() => {
    if (error) {
      toast({
        title: "אין הרשאה",
        description: "רק מנהלים יכולים לגשת לדף זה",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  if (authLoading || usersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">כוננות קל</h1>
          <p className="text-muted-foreground">טוען...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <Card className="max-w-md">
          <CardHeader>
            <Shield className="h-12 w-12 text-destructive mb-2" />
            <CardTitle>אין הרשאה</CardTitle>
            <CardDescription>רק מנהלים יכולים לגשת לדף זה</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button className="w-full" data-testid="button-back-home">
                <ArrowRight className="ml-2 h-4 w-4" />
                חזרה לדף הבית
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto px-4 py-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">ניהול מערכת</h1>
            <p className="text-muted-foreground">כוננות קל</p>
          </div>
          <Link href="/">
            <Button variant="outline" data-testid="button-back-dashboard">
              <ArrowRight className="ml-2 h-4 w-4" />
              חזרה ללוח הבקרה
            </Button>
          </Link>
        </header>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle>משתמשים רשומים</CardTitle>
              </div>
              <CardDescription>
                {users?.length || 0} משתמשים במערכת
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {users?.map((u) => (
                  <div key={u.id} className="flex items-center justify-between py-4" data-testid={`row-user-${u.id}`}>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={u.profileImageUrl || undefined} />
                        <AvatarFallback>
                          {(u.firstName?.[0] || u.email?.[0] || "?").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">
                          {u.firstName} {u.lastName}
                        </p>
                        <p className="text-sm text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {u.isAdmin && (
                        <Badge variant="default">מנהל</Badge>
                      )}
                      <Badge variant="secondary">
                        {new Date(u.createdAt!).toLocaleDateString("he-IL")}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
