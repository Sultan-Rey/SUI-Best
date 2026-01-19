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
  },
};

export default config;