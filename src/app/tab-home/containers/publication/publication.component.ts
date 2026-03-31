import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserProfile } from 'src/models/User';
import { Challenge } from 'src/models/Challenge';
import { PostContentComponent } from './containers/post-content/post-content.component';
import { PostExclusivityComponent } from './containers/post-exclusivity/post-exclusivity.component';
import { IonIcon, IonHeader } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  createOutline,
  starOutline,
  megaphoneOutline, lockClosed } from 'ionicons/icons';

@Component({
  selector: 'app-publication',
  templateUrl: './publication.component.html',
  styleUrls: ['./publication.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonHeader, 
    CommonModule,
    PostContentComponent,
    PostExclusivityComponent,
    IonIcon
  ]
})
export class PublicationComponent {

  @Input() CurrentUserProfile!: UserProfile;
  @Input() challenges: Challenge[] = [];
  @Input() isChallenging!: boolean;

  activeTab: 'content' | 'exclusivity' | 'ads' = 'content';

  constructor() {
    addIcons({createOutline,starOutline,lockClosed,megaphoneOutline});
  }

  setActiveTab(tab: 'content' | 'exclusivity' | 'ads'): void {
    this.activeTab = tab;
  }
}
