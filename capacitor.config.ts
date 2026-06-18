import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bestacademy.app',
  appName: 'StarInu',
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
      iosScheme: 'starinuniform',
      androidScheme: 'starinuniform',
      cleartext: true,
    },
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: false, // EMPECHE L'ECRAN BLANC D'APPARAITRE
      backgroundColor: '#000000', // Utilisez la couleur sombre de votre thème
      androidScaleType: 'CENTER_CROP',
      showSpinner: false
    }
  },
  
};

export default config;