export interface Setting {
  // Paramètres de confidentialité (utilisés dans SettingsPage)
  privacy: {
    enableLocation: boolean;
    contactsAccess: boolean;
    privateAccount: boolean;
    hideOnlineStatus: boolean;
  };

  // Paramètres de notifications (utilisés dans SettingsPage)
  notifications: {
    pushEnabled: boolean;
    emailEnabled: boolean;
  };

  // Paramètres de sécurité (utilisés dans SettingsPage)
  security: {
    twoFactorEnabled: boolean;
    activeSessionsCount: number;
  };

  // Métadonnées
  userId: string;
  updatedAt: string;
}


