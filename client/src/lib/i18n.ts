export type Language = "he" | "en";

export const translations = {
  he: {
    // App title and descriptions
    appName: "כוננות קל",
    appDescription: "ניטור קבוצות וואטסאפ",
    
    // Connection status
    connected: "מחובר",
    connecting: "מתחבר...",
    scanQR: "סרוק קוד QR",
    disconnected: "מנותק",
    
    // Connection card
    monitoringGroups: "מנטר {count} קבוצות",
    activeKeywords: "{count} מילות מפתח פעילות",
    
    // Connect section
    connectToWhatsApp: "התחבר לוואטסאפ",
    connectDescription: "לחץ על הכפתור למטה כדי להתחיל את תהליך ההתחברות לוואטסאפ שלך",
    connect: "התחבר לוואטסאפ",
    
    // QR section
    scanToConnect: "סרוק להתחברות",
    qrInstructions: "פתח את וואטסאפ בטלפון, לך להגדרות → מכשירים מקושרים → קשר מכשיר",
    qrRefreshAuto: "הקוד מתרענן אוטומטית",
    
    // Loading
    loading: "טוען...",
    initializingConnection: "מאתחל חיבור לוואטסאפ...",
    mayTakeMoment: "זה עשוי לקחת כמה רגעים",
    
    // Groups section
    groupsToMonitor: "קבוצות לניטור",
    groupsDescription: "בחר קבוצות לניטור התראות מילות מפתח",
    searchGroups: "חפש קבוצות...",
    selectAll: "בחר הכל",
    deselectAll: "בטל בחירה",
    selected: "נבחרו",
    watching: "במעקב",
    noGroupsFound: "לא נמצאו קבוצות תואמות",
    noGroupsAvailable: "אין קבוצות זמינות",
    refresh: "רענן",
    
    // Keywords section
    keywordsTitle: "מילות מפתח להתראה",
    keywordsDescription: "הכנס מילות מפתח מופרדות בפסיקים. כאשר הודעה מכילה אחת מהמילים האלה, תקבל הודעת וואטסאפ פרטית.",
    keywordsPlaceholder: "דחוף, חירום, עזרה, חשוב (מופרד בפסיקים)",
    
    // Per-group keywords
    perGroupKeywords: "מילות מפתח לפי קבוצה",
    perGroupDescription: "הגדר מילות מפתח ספציפיות לכל קבוצה במעקב",
    addKeywords: "הוסף מילות מפתח",
    noKeywordsForGroup: "אין מילות מפתח לקבוצה זו",
    enterKeywords: "הכנס מילות מפתח...",
    
    // Phone number
    phoneNumber: "מספר טלפון לקבלת התראות",
    phoneDescription: "הזן את מספר הטלפון שלך (עם קידומת מדינה) לקבלת התראות וואטסאפ",
    phonePlaceholder: "972501234567",
    
    // Alerts section
    recentAlerts: "התראות אחרונות",
    alertsCount: "{count} התראות",
    alertsDescription: "הודעות שהפעילו התראות מילות מפתח",
    noAlerts: "עדיין אין התראות",
    noAlertsDescription: "התראות יופיעו כאן כאשר הודעות יתאימו למילות המפתח שלך",
    alertSentToWhatsApp: "התראה נשלחה לוואטסאפ שלך",
    
    // Actions
    saveSettings: "שמור הגדרות",
    save: "שמור",
    cancel: "ביטול",
    delete: "מחק",
    
    // Admin
    admin: "ניהול",
    
    // Toasts
    alertReceived: "התראה נשלחה",
    keywordFoundIn: "מילת מפתח \"{keyword}\" נמצאה ב-{group}",
    settingsSaved: "ההגדרות נשמרו",
    settingsSavedDesc: "העדפות הניטור שלך עודכנו בהצלחה.",
    error: "שגיאה",
    
    // Time
    now: "עכשיו",
    minutesAgo: "לפני {count} דקות",
    hoursAgo: "לפני {count} שעות",
    daysAgo: "לפני {count} ימים",
    
    // Language toggle
    language: "שפה",
    hebrew: "עברית",
    english: "English",
  },
  en: {
    // App title and descriptions
    appName: "Konanut Kal",
    appDescription: "WhatsApp Group Monitoring",
    
    // Connection status
    connected: "Connected",
    connecting: "Connecting...",
    scanQR: "Scan QR Code",
    disconnected: "Disconnected",
    
    // Connection card
    monitoringGroups: "Monitoring {count} groups",
    activeKeywords: "{count} active keywords",
    
    // Connect section
    connectToWhatsApp: "Connect to WhatsApp",
    connectDescription: "Click the button below to start the connection process to your WhatsApp",
    connect: "Connect to WhatsApp",
    
    // QR section
    scanToConnect: "Scan to Connect",
    qrInstructions: "Open WhatsApp on your phone, go to Settings → Linked Devices → Link a Device",
    qrRefreshAuto: "QR code refreshes automatically",
    
    // Loading
    loading: "Loading...",
    initializingConnection: "Initializing WhatsApp connection...",
    mayTakeMoment: "This may take a few moments",
    
    // Groups section
    groupsToMonitor: "Groups to Monitor",
    groupsDescription: "Select groups to monitor for keyword alerts",
    searchGroups: "Search groups...",
    selectAll: "Select All",
    deselectAll: "Deselect All",
    selected: "selected",
    watching: "Watching",
    noGroupsFound: "No matching groups found",
    noGroupsAvailable: "No groups available",
    refresh: "Refresh",
    
    // Keywords section
    keywordsTitle: "Alert Keywords",
    keywordsDescription: "Enter keywords separated by commas. When a message contains one of these words, you'll receive a private WhatsApp message.",
    keywordsPlaceholder: "urgent, emergency, help, important (comma-separated)",
    
    // Per-group keywords
    perGroupKeywords: "Keywords by Group",
    perGroupDescription: "Set specific keywords for each monitored group",
    addKeywords: "Add Keywords",
    noKeywordsForGroup: "No keywords for this group",
    enterKeywords: "Enter keywords...",
    
    // Phone number
    phoneNumber: "Phone Number for Alerts",
    phoneDescription: "Enter your phone number (with country code) to receive WhatsApp alerts",
    phonePlaceholder: "972501234567",
    
    // Alerts section
    recentAlerts: "Recent Alerts",
    alertsCount: "{count} alerts",
    alertsDescription: "Messages that triggered keyword alerts",
    noAlerts: "No alerts yet",
    noAlertsDescription: "Alerts will appear here when messages match your keywords",
    alertSentToWhatsApp: "Alert sent to your WhatsApp",
    
    // Actions
    saveSettings: "Save Settings",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    
    // Admin
    admin: "Admin",
    
    // Toasts
    alertReceived: "Alert Received",
    keywordFoundIn: "Keyword \"{keyword}\" found in {group}",
    settingsSaved: "Settings Saved",
    settingsSavedDesc: "Your monitoring preferences have been updated successfully.",
    error: "Error",
    
    // Time
    now: "now",
    minutesAgo: "{count} minutes ago",
    hoursAgo: "{count} hours ago",
    daysAgo: "{count} days ago",
    
    // Language toggle
    language: "Language",
    hebrew: "עברית",
    english: "English",
  },
};

export type TranslationKey = keyof typeof translations.he;

export function t(lang: Language, key: TranslationKey, params?: Record<string, string | number>): string {
  let text = translations[lang][key] || translations.he[key] || key;
  
  if (params) {
    Object.entries(params).forEach(([paramKey, value]) => {
      text = text.replace(`{${paramKey}}`, String(value));
    });
  }
  
  return text;
}

export function useTranslation(lang: Language) {
  return {
    t: (key: TranslationKey, params?: Record<string, string | number>) => t(lang, key, params),
    lang,
    isRTL: lang === "he",
  };
}
