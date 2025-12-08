import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { Link } from "wouter";
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
  LogOut,
  Shield,
  Globe,
  Tag,
  Plus,
  X,
  Phone
} from "lucide-react";
import type { WhatsAppGroup, Settings as SettingsType, ConnectionStatus, GroupKeywordsSetting } from "@shared/schema";
import { useTranslation, type Language } from "@/lib/i18n";

interface AlertDisplay {
  id: number;
  groupId: string;
  groupName: string;
  matchedKeyword: string;
  messageText: string;
  senderName: string;
  timestamp: Date | string;
  alertSent: boolean;
}

export default function Dashboard() {
  const { toast } = useToast();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const toastRef = useRef(toast);
  const authenticatedRef = useRef(false);
  const langRef = useRef<Language>("he");
  
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [settings, setSettings] = useState<SettingsType>({
    watchedGroups: [],
    alertKeywords: [],
    myNumber: undefined,
    language: "he",
  });
  const [groupKeywords, setGroupKeywords] = useState<GroupKeywordsSetting[]>([]);
  const [keywordsInput, setKeywordsInput] = useState("");
  const [alerts, setAlerts] = useState<AlertDisplay[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isStartingWhatsApp, setIsStartingWhatsApp] = useState(false);
  
  // Per-group keywords dialog state
  const [keywordDialogOpen, setKeywordDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<WhatsAppGroup | null>(null);
  const [groupKeywordInput, setGroupKeywordInput] = useState("");
  
  // Language
  const lang = (settings.language || "he") as Language;
  const { t, isRTL } = useTranslation(lang);

  // Keep langRef in sync with settings.language
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = "/api/login";
    }
  }, [authLoading, isAuthenticated]);

  // Socket connection with user authentication
  useEffect(() => {
    if (!user?.id || authenticatedRef.current) return;

    const socket = io({
      path: "/socket.io",
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000,
    });

    socket.on("connect", () => {
      console.log("Socket connected, authenticating...");
      socket.emit("authenticate", user.id);
      authenticatedRef.current = true;
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
      authenticatedRef.current = false;
    });

    socket.on("connection_status", (status: ConnectionStatus) => {
      console.log("Connection status:", status);
      setConnectionStatus(status);
      setIsStartingWhatsApp(false);
      if (status === "connected") {
        setQrCode(null);
      }
    });

    socket.on("qr_code", (qr: string) => {
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
      setKeywordsInput(loadedSettings.alertKeywords?.join(", ") || "");
    });

    socket.on("group_keywords", (keywords: GroupKeywordsSetting[]) => {
      setGroupKeywords(keywords);
    });

    socket.on("alerts", (alertList: AlertDisplay[]) => {
      setAlerts(alertList);
    });

    socket.on("new_alert", (alert: AlertDisplay) => {
      setAlerts((prev) => [alert, ...prev].slice(0, 50));
      const currentLang = langRef.current;
      toastRef.current({
        title: currentLang === "he" ? "התראה נשלחה" : "Alert Received",
        description: currentLang === "he" 
          ? `מילת מפתח "${alert.matchedKeyword}" נמצאה ב-${alert.groupName}`
          : `Keyword "${alert.matchedKeyword}" found in ${alert.groupName}`,
      });
    });

    socket.on("settings_saved", () => {
      setIsSaving(false);
      const currentLang = langRef.current;
      toastRef.current({
        title: currentLang === "he" ? "ההגדרות נשמרו" : "Settings Saved",
        description: currentLang === "he" 
          ? "העדפות הניטור שלך עודכנו בהצלחה."
          : "Your monitoring preferences have been updated.",
      });
    });

    socket.on("group_keywords_saved", () => {
      const currentLang = langRef.current;
      toastRef.current({
        title: currentLang === "he" ? "מילות מפתח נשמרו" : "Keywords Saved",
        description: currentLang === "he" 
          ? "מילות המפתח לקבוצה עודכנו."
          : "Group keywords have been updated.",
      });
    });

    socket.on("error", (error: string) => {
      const currentLang = langRef.current;
      toastRef.current({
        title: currentLang === "en" ? "Error" : "שגיאה",
        description: error,
        variant: "destructive",
      });
      setIsStartingWhatsApp(false);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      authenticatedRef.current = false;
    };
  }, [user?.id]);

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

  const handleStartWhatsApp = () => {
    setIsStartingWhatsApp(true);
    socketRef.current?.emit("start_whatsapp");
  };

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const handleLanguageToggle = () => {
    const newLang = lang === "he" ? "en" : "he";
    setSettings((prev) => ({ ...prev, language: newLang }));
    socketRef.current?.emit("set_language", newLang);
  };

  const openKeywordDialog = (group: WhatsAppGroup) => {
    setSelectedGroup(group);
    const existing = groupKeywords.find((gk) => gk.groupId === group.id);
    setGroupKeywordInput(existing?.keywords?.join(", ") || "");
    setKeywordDialogOpen(true);
  };

  const handleSaveGroupKeywords = () => {
    if (!selectedGroup) return;
    
    const keywords = groupKeywordInput
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length > 0);
    
    socketRef.current?.emit("save_group_keywords", {
      groupId: selectedGroup.id,
      groupName: selectedGroup.name,
      keywords,
    });
    
    setKeywordDialogOpen(false);
    setSelectedGroup(null);
    setGroupKeywordInput("");
  };

  const getGroupKeywordCount = (groupId: string): number => {
    const gk = groupKeywords.find((k) => k.groupId === groupId);
    return gk?.keywords?.length || 0;
  };

  const filteredGroups = groups.filter((group) =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTimestamp = (timestamp: Date | string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t("now");
    if (diffMins < 60) return t("minutesAgo", { count: diffMins });
    if (diffHours < 24) return t("hoursAgo", { count: diffHours });
    if (diffDays < 7) return t("daysAgo", { count: diffDays });
    return date.toLocaleDateString(lang === "he" ? "he-IL" : "en-US");
  };

  const getStatusConfig = () => {
    switch (connectionStatus) {
      case "connected":
        return {
          icon: Wifi,
          text: t("connected"),
          bgClass: "bg-chart-2/10 dark:bg-chart-2/20",
          textClass: "text-chart-2",
          borderClass: "border-chart-2/30",
        };
      case "connecting":
        return {
          icon: Loader2,
          text: t("connecting"),
          bgClass: "bg-chart-3/10 dark:bg-chart-3/20",
          textClass: "text-chart-3",
          borderClass: "border-chart-3/30",
        };
      case "qr_ready":
        return {
          icon: QrCode,
          text: t("scanQR"),
          bgClass: "bg-primary/10 dark:bg-primary/20",
          textClass: "text-primary",
          borderClass: "border-primary/30",
        };
      default:
        return {
          icon: WifiOff,
          text: t("disconnected"),
          bgClass: "bg-destructive/10 dark:bg-destructive/20",
          textClass: "text-destructive",
          borderClass: "border-destructive/30",
        };
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir={isRTL ? "rtl" : "ltr"}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-muted-foreground">{t("loading")}</p>
        </div>
      </div>
    );
  }

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="py-4"
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-primary/20 to-chart-4/20 rounded-xl">
                <MessageSquare className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground" data-testid="text-app-title">{t("appName")}</h1>
                <p className="text-xs text-muted-foreground">{t("appDescription")}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLanguageToggle}
                data-testid="button-language-toggle"
                className="gap-2"
              >
                <Globe className="w-4 h-4" />
                <span className="text-sm">{lang === "he" ? "EN" : "עב"}</span>
              </Button>
              
              {user?.isAdmin && (
                <Link href="/admin">
                  <Button variant="outline" size="sm" data-testid="button-admin">
                    <Shield className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"}`} />
                    {t("admin")}
                  </Button>
                </Link>
              )}
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.profileImageUrl || undefined} />
                  <AvatarFallback>
                    {(user?.firstName?.[0] || user?.email?.[0] || "?").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="button-logout">
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
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
                        {t("monitoringGroups", { count: settings.watchedGroups.length })}
                      </p>
                    )}
                  </div>
                </div>
                {connectionStatus === "connected" && (
                  <Badge variant="secondary" className="text-sm px-3 py-1">
                    {t("activeKeywords", { count: groupKeywords.reduce((sum, gk) => sum + (gk.keywords?.length || 0), 0) })}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {connectionStatus === "disconnected" && !qrCode && !isStartingWhatsApp && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="overflow-hidden" data-testid="card-connect">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <motion.div 
                  className="p-6 bg-gradient-to-br from-chart-2/20 to-primary/20 rounded-full mb-6"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <MessageSquare className="w-12 h-12 text-chart-2" />
                </motion.div>
                <h3 className="text-xl font-semibold mb-2">{t("connectToWhatsApp")}</h3>
                <p className="text-muted-foreground text-center max-w-sm mb-6">
                  {t("connectDescription")}
                </p>
                <Button 
                  size="lg"
                  onClick={handleStartWhatsApp}
                  className="gap-2"
                  data-testid="button-connect-whatsapp"
                >
                  <Wifi className="w-5 h-5" />
                  {t("connect")}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

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
                  {t("scanToConnect")}
                </CardTitle>
                <CardDescription className="max-w-sm mx-auto">
                  {t("qrInstructions")}
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
                    alt="WhatsApp QR Code" 
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
                  {t("qrRefreshAuto")}
                </motion.p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {(connectionStatus === "connecting" || isStartingWhatsApp) && !qrCode && (
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
                  {t("initializingConnection")}
                </motion.p>
                <p className="text-sm text-muted-foreground/70 mt-2">
                  {t("mayTakeMoment")}
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
            {/* Phone Number Input */}
            <Card data-testid="card-phone">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                  <CardTitle className="text-lg">{t("phoneNumber")}</CardTitle>
                </div>
                <CardDescription>
                  {t("phoneDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Input
                  type="tel"
                  placeholder={t("phonePlaceholder")}
                  value={settings.myNumber || ""}
                  onChange={(e) => setSettings((prev) => ({ ...prev, myNumber: e.target.value }))}
                  data-testid="input-phone"
                  className="max-w-xs"
                  dir="ltr"
                />
              </CardContent>
            </Card>

            {/* Groups Section */}
            <Card data-testid="card-groups">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-muted-foreground" />
                    <CardTitle className="text-lg">{t("groupsToMonitor")}</CardTitle>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleRefreshGroups}
                    disabled={isLoadingGroups}
                    data-testid="button-refresh-groups"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"} ${isLoadingGroups ? "animate-spin" : ""}`} />
                    {t("refresh")}
                  </Button>
                </div>
                <CardDescription>
                  {t("groupsDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground`} />
                  <Input
                    placeholder={t("searchGroups")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={isRTL ? "pr-9" : "pl-9"}
                    data-testid="input-search-groups"
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleSelectAll}
                    data-testid="button-select-all"
                  >
                    <CheckCircle2 className={`w-4 h-4 ${isRTL ? "ml-1" : "mr-1"}`} />
                    {t("selectAll")}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleDeselectAll}
                    data-testid="button-deselect-all"
                  >
                    {t("deselectAll")}
                  </Button>
                  <Badge variant="secondary" className={isRTL ? "mr-auto" : "ml-auto"}>
                    {settings.watchedGroups.length} {t("selected")}
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
                          {searchQuery ? t("noGroupsFound") : t("noGroupsAvailable")}
                        </p>
                      </div>
                    ) : (
                      filteredGroups.map((group) => {
                        const isWatched = settings.watchedGroups.includes(group.id);
                        const keywordCount = getGroupKeywordCount(group.id);
                        
                        return (
                          <div
                            key={group.id}
                            className="flex items-center gap-3 p-3 rounded-lg hover-elevate transition-colors"
                            data-testid={`row-group-${group.id}`}
                          >
                            <label className="flex items-center gap-3 flex-1 cursor-pointer">
                              <Checkbox
                                checked={isWatched}
                                onCheckedChange={() => handleGroupToggle(group.id)}
                                data-testid={`checkbox-group-${group.id}`}
                              />
                              <span className="text-sm flex-1 truncate">{group.name}</span>
                            </label>
                            
                            <div className="flex items-center gap-2 shrink-0">
                              {isWatched && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openKeywordDialog(group)}
                                    className="h-7 px-2 text-xs"
                                    data-testid={`button-keywords-${group.id}`}
                                  >
                                    <Tag className={`w-3 h-3 ${isRTL ? "ml-1" : "mr-1"}`} />
                                    {keywordCount > 0 ? keywordCount : <Plus className="w-3 h-3" />}
                                  </Button>
                                  <Badge variant="secondary" className="text-xs shrink-0">
                                    {t("watching")}
                                  </Badge>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Per-Group Keywords Summary */}
            {groupKeywords.length > 0 && (
              <Card data-testid="card-group-keywords-summary">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <Tag className="w-5 h-5 text-muted-foreground" />
                    <CardTitle className="text-lg">{t("perGroupKeywords")}</CardTitle>
                  </div>
                  <CardDescription>
                    {t("perGroupDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {groupKeywords.map((gk) => (
                      <div key={gk.groupId} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                        <span className="text-sm font-medium">{gk.groupName}:</span>
                        <div className="flex flex-wrap gap-1">
                          {gk.keywords?.slice(0, 3).map((kw, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {kw}
                            </Badge>
                          ))}
                          {gk.keywords && gk.keywords.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{gk.keywords.length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Global Keywords (Legacy) */}
            <Card data-testid="card-keywords">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-muted-foreground" />
                  <CardTitle className="text-lg">{t("keywordsTitle")}</CardTitle>
                </div>
                <CardDescription>
                  {t("keywordsDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder={t("keywordsPlaceholder")}
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
                  <Loader2 className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"} animate-spin`} />
                ) : (
                  <Save className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"}`} />
                )}
                {t("saveSettings")}
              </Button>
            </div>

            <Card data-testid="card-alerts">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-muted-foreground" />
                    <CardTitle className="text-lg">{t("recentAlerts")}</CardTitle>
                  </div>
                  <Badge variant="secondary">
                    {t("alertsCount", { count: alerts.length })}
                  </Badge>
                </div>
                <CardDescription>
                  {t("alertsDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-80">
                  {alerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Bell className="w-10 h-10 text-muted-foreground/30 mb-3" />
                      <p className="text-sm font-medium text-muted-foreground">{t("noAlerts")}</p>
                      <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
                        {t("noAlertsDescription")}
                      </p>
                    </div>
                  ) : (
                    <div className={`space-y-3 ${isRTL ? "pl-4" : "pr-4"}`}>
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
                              <span>{t("alertSentToWhatsApp")}</span>
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

      {/* Per-Group Keywords Dialog */}
      <Dialog open={keywordDialogOpen} onOpenChange={setKeywordDialogOpen}>
        <DialogContent className="sm:max-w-md" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5" />
              {selectedGroup?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              {t("enterKeywords")}
            </p>
            <Input
              placeholder={t("keywordsPlaceholder")}
              value={groupKeywordInput}
              onChange={(e) => setGroupKeywordInput(e.target.value)}
              data-testid="input-group-keywords"
            />
            <div className="flex flex-wrap gap-2">
              {groupKeywordInput
                .split(",")
                .map((k) => k.trim())
                .filter((k) => k.length > 0)
                .map((keyword, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {keyword}
                  </Badge>
                ))}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setKeywordDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleSaveGroupKeywords} data-testid="button-save-group-keywords">
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
