export type Language = "he" | "en";

// Language storage key for localStorage
export const LANGUAGE_STORAGE_KEY = "app_language";

// Get stored language from localStorage
export function getStoredLanguage(): Language {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === "he" || stored === "en") {
      return stored;
    }
  }
  return "he"; // Default to Hebrew
}

// Store language in localStorage (only if changed)
export function setStoredLanguage(lang: Language): void {
  if (typeof window !== "undefined") {
    const currentLang = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    const currentDir = document.documentElement.getAttribute("dir");
    const expectedDir = lang === "he" ? "rtl" : "ltr";
    
    // Only update if actually changed
    if (currentLang !== lang) {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    }
    if (currentDir !== expectedDir) {
      document.documentElement.setAttribute("dir", expectedDir);
      document.documentElement.setAttribute("lang", lang);
    }
  }
}

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
    
    // Landing page
    landingTitle: "ניטור קבוצות WhatsApp בזמן אמת",
    landingSubtitle: "קבלו התראות פרטיות כאשר מילות מפתח מופיעות בקבוצות שלכם",
    getStarted: "התחילו עכשיו - חינם",
    login: "התחברות",
    groupMonitoring: "ניטור קבוצות",
    groupMonitoringDesc: "בחרו קבוצות WhatsApp לניטור ומילות מפתח לחיפוש",
    realTimeAlerts: "התראות בזמן אמת",
    realTimeAlertsDesc: "קבלו הודעה פרטית ב-WhatsApp כאשר מזהים מילת מפתח",
    securePrivate: "מאובטח ופרטי",
    securePrivateDesc: "חיבור מאובטח - הנתונים שלכם נשארים רק אצלכם",
    multiUser: "רב-משתמשים",
    multiUserDesc: "כל משתמש מחבר את ה-WhatsApp שלו ומקבל התראות משלו",
    howItWorks: "איך זה עובד?",
    step1: "התחברו עם חשבון Google או אחר",
    step2: "סרקו קוד QR לחיבור WhatsApp שלכם",
    step3: "בחרו קבוצות והגדירו מילות מפתח",
    step4: "קבלו התראות פרטיות ישירות ל-WhatsApp שלכם",
    copyright: "© {year} {appName}. כל הזכויות שמורות.",
  },
  en: {
    // App title and descriptions
    appName: "Whatsappdibs",
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
    
    // Landing page
    landingTitle: "Real-Time WhatsApp Group Monitoring",
    landingSubtitle: "Get private alerts when keywords appear in your groups",
    getStarted: "Get Started - Free",
    login: "Login",
    groupMonitoring: "Group Monitoring",
    groupMonitoringDesc: "Choose WhatsApp groups to monitor and keywords to search",
    realTimeAlerts: "Real-Time Alerts",
    realTimeAlertsDesc: "Receive a private WhatsApp message when a keyword is detected",
    securePrivate: "Secure & Private",
    securePrivateDesc: "Secure connection - your data stays only with you",
    multiUser: "Multi-User",
    multiUserDesc: "Each user connects their own WhatsApp and receives their own alerts",
    howItWorks: "How It Works",
    step1: "Sign in with Google or another account",
    step2: "Scan QR code to connect your WhatsApp",
    step3: "Select groups and set keywords",
    step4: "Receive private alerts directly to your WhatsApp",
    copyright: "© {year} {appName}. All rights reserved.",
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
