import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bestacademy.app',
  appName: 'Best',
  webDir: 'www',
  // Ajout de la configuration pour le plugin HTTP natif
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    // Configuration pour InAppBrowser et deep links
    Browser: {
      enabled: true,
    },
    // Configuration des notifications locales
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config',
      iconColor: '#FF6B35',
      sound: 'default'
    },
    // Configuration des Push Notifications
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    // Configuration des URL schemes pour les deep links
    server: {
      iosScheme: 'bestacademy',
      androidScheme: 'bestacademy',
      cleartext: true,
    },
  },
};

export default config;