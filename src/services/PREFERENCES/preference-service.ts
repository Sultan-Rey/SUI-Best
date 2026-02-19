import { Injectable } from '@angular/core';
import { Setting } from '../../models/Setting';

@Injectable({
  providedIn: 'root',
})
export class PreferenceService {

  private readonly STORAGE_KEY = 'best_user_settings';

  constructor() { }

  /* ======================
     INITIALISATION
     ====================== */

  initializeSettings(userId: string): Setting {
    const defaultSettings: Setting = {
      privacy: {
        enableLocation: true,
        contactsAccess: true,
        privateAccount: false,
        hideOnlineStatus: false,
      },
      notifications: {
        pushEnabled: true,
        emailEnabled: true,
      },
      security: {
        twoFactorEnabled: false,
        activeSessionsCount: 1,
      },
      userId: userId,
      updatedAt: new Date().toISOString(),
    };

    this.saveSettings(defaultSettings);
    return defaultSettings;
  }

  /* ======================
     CHARGEMENT
     ====================== */

  getSettings(): Setting | null {
    const settings = localStorage.getItem(this.STORAGE_KEY);
    return settings ? JSON.parse(settings) : null;
  }

  getSettingsForUser(userId: string): Setting | null {
    const allSettings = this.getAllUsersSettings();
    return allSettings[userId] || null;
  }

  getAllUsersSettings(): { [userId: string]: Setting } {
    const settings = localStorage.getItem(this.STORAGE_KEY);
    return settings ? JSON.parse(settings) : {};
  }

  /* ======================
     SAUVEGARDE
     ====================== */

  saveSettings(settings: Setting): void {
    const allSettings = this.getAllUsersSettings();
    allSettings[settings.userId] = {
      ...settings,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allSettings));
  }

  /* ======================
     PARAMÈTRES DE CONFIDENTIALITÉ
     ====================== */

  updatePrivacySettings(userId: string, privacy: Partial<Setting['privacy']>): void {
    const settings = this.getSettingsForUser(userId) || this.initializeSettings(userId);
    settings.privacy = { ...settings.privacy, ...privacy };
    this.saveSettings(settings);
  }

  toggleLocationAccess(userId: string): void {
    const settings = this.getSettingsForUser(userId) || this.initializeSettings(userId);
    settings.privacy.enableLocation = !settings.privacy.enableLocation;
    this.saveSettings(settings);
  }

  toggleContactsAccess(userId: string): void {
    const settings = this.getSettingsForUser(userId) || this.initializeSettings(userId);
    settings.privacy.contactsAccess = !settings.privacy.contactsAccess;
    this.saveSettings(settings);
  }

  togglePrivateAccount(userId: string): void {
    const settings = this.getSettingsForUser(userId) || this.initializeSettings(userId);
    settings.privacy.privateAccount = !settings.privacy.privateAccount;
    this.saveSettings(settings);
  }

  toggleOnlineStatusVisibility(userId: string): void {
    const settings = this.getSettingsForUser(userId) || this.initializeSettings(userId);
    settings.privacy.hideOnlineStatus = !settings.privacy.hideOnlineStatus;
    this.saveSettings(settings);
  }

  /* ======================
     PARAMÈTRES DE NOTIFICATIONS
     ====================== */

  updateNotificationSettings(userId: string, notifications: Partial<Setting['notifications']>): void {
    const settings = this.getSettingsForUser(userId) || this.initializeSettings(userId);
    settings.notifications = { ...settings.notifications, ...notifications };
    this.saveSettings(settings);
  }

  togglePushNotifications(userId: string): void {
    const settings = this.getSettingsForUser(userId) || this.initializeSettings(userId);
    settings.notifications.pushEnabled = !settings.notifications.pushEnabled;
    this.saveSettings(settings);
  }

  toggleEmailNotifications(userId: string): void {
    const settings = this.getSettingsForUser(userId) || this.initializeSettings(userId);
    settings.notifications.emailEnabled = !settings.notifications.emailEnabled;
    this.saveSettings(settings);
  }

  /* ======================
     PARAMÈTRES DE SÉCURITÉ
     ====================== */

  updateSecuritySettings(userId: string, security: Partial<Setting['security']>): void {
    const settings = this.getSettingsForUser(userId) || this.initializeSettings(userId);
    settings.security = { ...settings.security, ...security };
    this.saveSettings(settings);
  }

  toggleTwoFactorAuth(userId: string): void {
    const settings = this.getSettingsForUser(userId) || this.initializeSettings(userId);
    settings.security.twoFactorEnabled = !settings.security.twoFactorEnabled;
    this.saveSettings(settings);
  }

  updateActiveSessionsCount(userId: string, count: number): void {
    const settings = this.getSettingsForUser(userId) || this.initializeSettings(userId);
    settings.security.activeSessionsCount = count;
    this.saveSettings(settings);
  }

  /* ======================
     UTILITAIRES
     ====================== */

  resetToDefaults(userId: string): Setting {
    return this.initializeSettings(userId);
  }

  deleteSettingsForUser(userId: string): void {
    const allSettings = this.getAllUsersSettings();
    delete allSettings[userId];
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allSettings));
  }

  clearAllSettings(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.STORAGE_KEY);
  }

  exportSettings(userId: string): string {
    const settings = this.getSettingsForUser(userId);
    return settings ? JSON.stringify(settings, null, 2) : '';
  }

  importSettings(userId: string, settingsJson: string): boolean {
    try {
      const settings: Setting = JSON.parse(settingsJson);
      if (settings.userId !== userId) {
        settings.userId = userId;
      }
      this.saveSettings(settings);
      return true;
    } catch (error) {
      console.error('Erreur lors de l\'importation des paramètres:', error);
      return false;
    }
  }
}
