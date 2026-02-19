# ModalSelectPostComponent

Ce composant permet d'afficher une liste des posts d'un utilisateur et d'en sélectionner un.

## Utilisation

### Import du composant

```typescript
import { ModalSelectPostComponent } from '../modal-select-post/modal-select-post.component';
```

### Ouverture du modal

```typescript
async openPostSelectionModal() {
  const modal = await this.modalController.create({
    component: ModalSelectPostComponent,
    componentProps: {
      currentUserProfile: this.userProfile // UserProfile de l'utilisateur dont on veut voir les posts
    },
    cssClass: 'modal-select-post'
  });

  modal.onDidDismiss().then((result) => {
    if (result.data && result.data.selected) {
      const selectedPost = result.data.post;
      console.log('Post sélectionné:', selectedPost);
      // Faire quelque chose avec le post sélectionné
    }
  });

  await modal.present();
}
```

### Écouter l'événement de sélection

```typescript
// Dans le template du composant parent
<app-modal-select-post 
  [currentUserProfile]="userProfile"
  (postSelected)="onPostSelected($event)">
</app-modal-select-post>

// Dans le composant parent
onPostSelected(post: Content) {
  console.log('Post sélectionné:', post);
  // Traiter le post sélectionné
}
```

## Propriétés

### @Input()

- **currentUserProfile**: `UserProfile` (requis)
  - Le profil de l'utilisateur dont on veut afficher les posts

### @Output()

- **postSelected**: `EventEmitter<Content>`
  - Émis lorsqu'un post est sélectionné et confirmé

## Fonctionnalités

- **Affichage en grille** des posts de l'utilisateur
- **Recherche** par description ou tags
- **Sélection visuelle** avec badge de confirmation
- **Support images et vidéos** avec icône appropriée
- **Statistiques** affichées (vues, likes)
- **Responsive design** pour mobile et desktop
- **Animations** fluides et interactions modernes

## Services utilisés

- `CreationService.getUserContents()` pour récupérer les posts de l'utilisateur
- `formatViewCount()` pour le formatage des nombres

## Styles

Le composant utilise des variables CSS Ionic pour s'adapter au thème de l'application :
- `--ion-color-primary`
- `--ion-color-light`
- `--ion-color-dark`
- `--ion-color-medium`
