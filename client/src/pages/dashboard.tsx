import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { 
  Wifi, 
  WifiOff, 
  MessageSquare, 
  Settings, 
  Bell, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  Loader2,
  QrCode,
  Users,
  Search,
  Sparkles,
  Zap
} from "lucide-react";
import type { WhatsAppGroup, Settings as SettingsType, Alert, ConnectionStatus } from "@shared/schema";

export default function Dashboard() {
  const { toast } = useToast();
  const socketRef = useRef<Socket | null>(null);
  const toastRef = useRef(toast);
  
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [settings, setSettings] = useState<SettingsType>({
    watchedGroups: [],
    alertKeywords: [],
    myNumber: undefined,
  });
  const [keywordsInput, setKeywordsInput] = useState("");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  useEffect(() => {
    if (socketRef.current?.connected) return;

    const socket = io({
      path: "/socket.io",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on("connect", () => {
      console.log("Socket connected");
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
    });

    socket.on("connection_status", (status: ConnectionStatus) => {
      console.log("Connection status:", status);
      setConnectionStatus(status);
      if (status === "connected") {
        setQrCode(null);
      }
    });

    socket.on("qr", (qr: string) => {
      console.log("QR code received");
      setQrCode(qr);
      setConnectionStatus("qr_ready");
    });

    socket.on("groups", (groupList: WhatsAppGroup[]) => {
      setGroups(groupList);
      setIsLoadingGroups(false);
    });

    socket.on("settings", (loadedSettings: SettingsType) => {
      setSettings(loadedSettings);
      setKeywordsInput(loadedSettings.alertKeywords.join(", "));
    });

    socket.on("alerts", (alertList: Alert[]) => {
      setAlerts(alertList);
    });

    socket.on("new_alert", (alert: Alert) => {
      setAlerts((prev) => [alert, ...prev].slice(0, 50));
      toastRef.current({
        title: "התראה נשלחה",
        description: `מילת מפתח "${alert.matchedKeyword}" נמצאה ב-${alert.groupName}`,
      });
    });

    socket.on("settings_saved", () => {
      setIsSaving(false);
      toastRef.current({
        title: "ההגדרות נשמרו",
        description: "העדפות הניטור שלך עודכנו בהצלחה.",
      });
    });

    socket.on("error", (error: string) => {
      toastRef.current({
        title: "שגיאה",
        description: error,
        variant: "destructive",
      });
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleGroupToggle = (groupId: string) => {
    setSettings((prev) => {
      const isWatched = prev.watchedGroups.includes(groupId);
      return {
        ...prev,
        watchedGroups: isWatched
          ? prev.watchedGroups.filter((id) => id !== groupId)
          : [...prev.watchedGroups, groupId],
      };
    });
  };

  const handleSelectAll = () => {
    const groupIds = filteredGroups.map((g) => g.id);
    setSettings((prev) => ({
      ...prev,
      watchedGroups: Array.from(new Set([...prev.watchedGroups, ...groupIds])),
    }));
  };

  const handleDeselectAll = () => {
    const groupIds = filteredGroups.map((g) => g.id);
    setSettings((prev) => ({
      ...prev,
      watchedGroups: prev.watchedGroups.filter((id) => !groupIds.includes(id)),
    }));
  };

  const handleSaveSettings = () => {
    setIsSaving(true);
    const keywords = keywordsInput
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length > 0);
    
    const updatedSettings = {
      ...settings,
      alertKeywords: keywords,
    };
    
    socketRef.current?.emit("save_settings", updatedSettings);
  };

  const handleRefreshGroups = () => {
    setIsLoadingGroups(true);
    socketRef.current?.emit("refresh_groups");
  };

  const filteredGroups = groups.filter((group) =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "עכשיו";
    if (diffMins < 60) return `לפני ${diffMins} דקות`;
    if (diffHours < 24) return `לפני ${diffHours} שעות`;
    if (diffDays < 7) return `לפני ${diffDays} ימים`;
    return date.toLocaleDateString("he-IL");
  };

  const getStatusConfig = () => {
    switch (connectionStatus) {
      case "connected":
        return {
          icon: Wifi,
          text: "מחובר",
          bgClass: "bg-chart-2/10 dark:bg-chart-2/20",
          textClass: "text-chart-2",
          borderClass: "border-chart-2/30",
        };
      case "connecting":
        return {
          icon: Loader2,
          text: "מתחבר...",
          bgClass: "bg-chart-3/10 dark:bg-chart-3/20",
          textClass: "text-chart-3",
          borderClass: "border-chart-3/30",
        };
      case "qr_ready":
        return {
          icon: QrCode,
          text: "סרוק קוד QR",
          bgClass: "bg-primary/10 dark:bg-primary/20",
          textClass: "text-primary",
          borderClass: "border-primary/30",
        };
      default:
        return {
          icon: WifiOff,
          text: "מנותק",
          bgClass: "bg-destructive/10 dark:bg-destructive/20",
          textClass: "text-destructive",
          borderClass: "border-destructive/30",
        };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center py-6"
        >
          <div className="flex flex-col items-center gap-4">
            <motion.div 
              className="relative"
              animate={{ 
                rotate: [0, 5, -5, 0],
              }}
              transition={{ 
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <div className="p-4 bg-gradient-to-br from-primary/20 to-chart-4/20 rounded-2xl shadow-lg">
                <MessageSquare className="w-10 h-10 text-primary" />
              </div>
              <motion.div 
                className="absolute -top-1 -left-1"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Sparkles className="w-5 h-5 text-chart-3" />
              </motion.div>
            </motion.div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-primary via-chart-4 to-chart-5 bg-clip-text text-transparent" data-testid="text-app-title">שני בקבוקי שתייה</h1>
              <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-2">
                <Zap className="w-4 h-4 text-chart-3" />
                ניטור קבוצות וואטסאפ
                <Zap className="w-4 h-4 text-chart-3" />
              </p>
            </div>
          </div>
        </motion.header>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <Card className={`border-2 ${statusConfig.borderClass} ${statusConfig.bgClass} shadow-md`} data-testid="card-status">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={connectionStatus === "connecting" ? { rotate: 360 } : {}}
                    transition={{ duration: 1, repeat: connectionStatus === "connecting" ? Infinity : 0, ease: "linear" }}
                  >
                    <StatusIcon className={`w-6 h-6 ${statusConfig.textClass}`} />
                  </motion.div>
                  <div>
                    <p className={`font-semibold text-lg ${statusConfig.textClass}`} data-testid="text-connection-status">
                      {statusConfig.text}
                    </p>
                    {connectionStatus === "connected" && (
                      <p className="text-xs text-muted-foreground">
                        מנטר {settings.watchedGroups.length} קבוצות
                      </p>
                    )}
                  </div>
                </div>
                {connectionStatus === "connected" && (
                  <Badge variant="secondary" className="text-sm px-3 py-1">
                    {settings.alertKeywords.length} מילות מפתח פעילות
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {(connectionStatus === "qr_ready" || connectionStatus === "disconnected") && qrCode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="overflow-hidden" data-testid="card-qr-code">
              <CardHeader className="pb-4 text-center bg-gradient-to-r from-primary/5 to-chart-4/5">
                <CardTitle className="flex items-center justify-center gap-2 text-xl">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <QrCode className="w-6 h-6 text-primary" />
                  </motion.div>
                  סרוק להתחברות
                </CardTitle>
                <CardDescription className="max-w-sm mx-auto">
                  פתח את וואטסאפ בטלפון, לך להגדרות ← מכשירים מקושרים ← קשר מכשיר
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center py-8">
                <motion.div 
                  className="bg-white p-6 rounded-2xl shadow-lg border-2 border-primary/20"
                  animate={{ 
                    boxShadow: ["0 10px 40px rgba(0,0,0,0.1)", "0 10px 40px rgba(59, 130, 246, 0.2)", "0 10px 40px rgba(0,0,0,0.1)"]
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <img 
                    src={qrCode} 
                    alt="קוד QR לוואטסאפ" 
                    className="w-64 h-64 object-contain"
                    data-testid="img-qr-code"
                  />
                </motion.div>
                <motion.p 
                  className="text-sm text-muted-foreground mt-6 text-center max-w-xs flex items-center gap-2"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <RefreshCw className="w-4 h-4" />
                  הקוד מתרענן אוטומטית
                </motion.p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {connectionStatus === "connecting" && !qrCode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="overflow-hidden">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <motion.div
                  className="relative"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary" />
                </motion.div>
                <motion.p 
                  className="text-muted-foreground mt-6 text-lg font-medium"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  מאתחל חיבור לוואטסאפ...
                </motion.p>
                <p className="text-sm text-muted-foreground/70 mt-2">
                  זה עשוי לקחת כמה רגעים
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {connectionStatus === "connected" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            <Card data-testid="card-groups">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-muted-foreground" />
                    <CardTitle className="text-lg">קבוצות לניטור</CardTitle>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleRefreshGroups}
                    disabled={isLoadingGroups}
                    data-testid="button-refresh-groups"
                  >
                    <RefreshCw className={`w-4 h-4 ml-2 ${isLoadingGroups ? "animate-spin" : ""}`} />
                    רענן
                  </Button>
                </div>
                <CardDescription>
                  בחר קבוצות לניטור התראות מילות מפתח
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="חפש קבוצות..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-9"
                    data-testid="input-search-groups"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleSelectAll}
                    data-testid="button-select-all"
                  >
                    <CheckCircle2 className="w-4 h-4 ml-1" />
                    בחר הכל
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleDeselectAll}
                    data-testid="button-deselect-all"
                  >
                    בטל בחירה
                  </Button>
                  <Badge variant="secondary" className="mr-auto">
                    {settings.watchedGroups.length} נבחרו
                  </Badge>
                </div>

                <ScrollArea className="h-72 rounded-md border">
                  <div className="p-3 space-y-1">
                    {isLoadingGroups ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : filteredGroups.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Users className="w-8 h-8 text-muted-foreground/50 mb-2" />
                        <p className="text-sm text-muted-foreground">
                          {searchQuery ? "לא נמצאו קבוצות תואמות" : "אין קבוצות זמינות"}
                        </p>
                      </div>
                    ) : (
                      filteredGroups.map((group) => (
                        <label
                          key={group.id}
                          className="flex items-center gap-3 p-3 rounded-lg hover-elevate cursor-pointer transition-colors"
                          data-testid={`label-group-${group.id}`}
                        >
                          <Checkbox
                            checked={settings.watchedGroups.includes(group.id)}
                            onCheckedChange={() => handleGroupToggle(group.id)}
                            data-testid={`checkbox-group-${group.id}`}
                          />
                          <span className="text-sm flex-1 truncate">{group.name}</span>
                          {settings.watchedGroups.includes(group.id) && (
                            <Badge variant="secondary" className="text-xs shrink-0">
                              במעקב
                            </Badge>
                          )}
                        </label>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card data-testid="card-keywords">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-muted-foreground" />
                  <CardTitle className="text-lg">מילות מפתח להתראה</CardTitle>
                </div>
                <CardDescription>
                  הכנס מילות מפתח מופרדות בפסיקים. כאשר הודעה מכילה אחת מהמילים האלה, תקבל הודעת וואטסאפ פרטית.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="דחוף, חירום, עזרה, חשוב (מופרד בפסיקים)"
                  value={keywordsInput}
                  onChange={(e) => setKeywordsInput(e.target.value)}
                  data-testid="input-keywords"
                />
                <div className="flex flex-wrap gap-2">
                  {keywordsInput
                    .split(",")
                    .map((k) => k.trim())
                    .filter((k) => k.length > 0)
                    .map((keyword, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {keyword}
                      </Badge>
                    ))}
                </div>
              </CardContent>
            </Card>

            <div className="sticky bottom-4 z-10">
              <Button 
                className="w-full shadow-lg" 
                size="lg"
                onClick={handleSaveSettings}
                disabled={isSaving}
                data-testid="button-save-settings"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 ml-2" />
                )}
                שמור הגדרות
              </Button>
            </div>

            <Card data-testid="card-alerts">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-muted-foreground" />
                    <CardTitle className="text-lg">התראות אחרונות</CardTitle>
                  </div>
                  <Badge variant="secondary">
                    {alerts.length} התראות
                  </Badge>
                </div>
                <CardDescription>
                  הודעות שהפעילו התראות מילות מפתח
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-80">
                  {alerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Bell className="w-10 h-10 text-muted-foreground/30 mb-3" />
                      <p className="text-sm font-medium text-muted-foreground">עדיין אין התראות</p>
                      <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
                        התראות יופיעו כאן כאשר הודעות יתאימו למילות המפתח שלך
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 pl-4">
                      {alerts.map((alert) => (
                        <div 
                          key={alert.id} 
                          className="p-4 rounded-lg bg-card border space-y-2"
                          data-testid={`card-alert-${alert.id}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{alert.groupName}</span>
                              <Badge className="text-xs">{alert.matchedKeyword}</Badge>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatTimestamp(alert.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium">{alert.senderName}:</span>{" "}
                            {alert.messageText.length > 200
                              ? `${alert.messageText.slice(0, 200)}...`
                              : alert.messageText}
                          </p>
                          {alert.alertSent && (
                            <div className="flex items-center gap-1 text-xs text-chart-2">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>התראה נשלחה לוואטסאפ שלך</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
