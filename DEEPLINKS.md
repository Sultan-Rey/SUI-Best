# Guide d'utilisation des Deep Links - Best Academy

## Configuration terminée ✅

Les deep links sont maintenant configurés pour votre application Best Academy.

## URLs disponibles

### Routes principales :
- `bestacademy://home` - Page d'accueil
- `bestacademy://login` - Page de connexion
- `bestacademy://register` - Page d'inscription
- `bestacademy://settings` - Paramètres
- `bestacademy://search` - Recherche
- `bestacademy://subscription` - Abonnement
- `bestacademy://ranking` - Classement
- `bestacademy://exclusive` - Contenu exclusif
- `bestacademy://blacklist` - Liste noire

### Routes avec paramètres :
- `bestacademy://profile/123` - Profil utilisateur (remplacer 123 par l'ID utilisateur)

## Comment tester

### 1. Rebuild l'application
```bash
# Pour Android
ionic cap build android

# Pour iOS  
ionic cap build ios
```

### 2. Tester sur Android
```bash
# Via ADB
adb shell am start -W -a android.intent.action.VIEW -d "bestacademy://home" com.bestacademy.app

# Ou scanner un QR code avec l'URL
```

### 3. Tester sur iOS
```bash
# Via Safari sur l'appareil
# Taper directement dans Safari : bestacademy://home
```

### 4. Tester dans le navigateur (développement)
```bash
# URL de test : http://localhost:8100/home
# Les deep links fonctionnent aussi avec les URLs web normales
```

## Cas d'usage pratiques

### Partage de profil
- Partager un profil : `bestacademy://profile/123`
- L'utilisateur arrive directement sur la page du profil

### Notifications
- Lien vers une récompense : `bestacademy://exclusive`
- Lien vers le classement : `bestacademy://ranking`

### Marketing
- Lien d'inscription : `bestacademy://register`
- Lien d'abonnement : `bestacademy://subscription`

## Sécurité

- Les routes protégées par `authGuard` redirigent vers la login si nécessaire
- En cas d'URL invalide, redirection vers `/home`

## Débogage

Les logs de deep links apparaissent dans la console :
```
Deep link reçu: bestacademy://profile/123
```

## Prochaines améliorations possibles

1. **Liens dynamiques Firebase** - Pour le suivi analytics
2. **Paramètres supplémentaires** - Pour passer des données complexes
3. **Web fallback** - Redirection vers le site web si app non installée
