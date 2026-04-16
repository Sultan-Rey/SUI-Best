import { Component, Input, Output, EventEmitter, HostBinding } from '@angular/core';
import { Router } from '@angular/router';
import { NgFor, NgIf } from '@angular/common';
import { IonIcon, IonAvatar } from "@ionic/angular/standalone";
import { SafeHtmlPipe } from "../bottom-navigation/safe-html.pipe";
import { AsyncPipe } from '@angular/common';
import { MediaUrlPipe } from 'src/app/utils/pipes/mediaUrlPipe/media-url-pipe';
interface NavItem {
  idx: number;
  page: string;
  label: string;
  emoji: string;
  route: string;
  iconPath: string;
  badge?: number;
  star?: boolean;
  visible?: boolean;
}
@Component({
  selector: 'app-menu-burger',
  templateUrl: './menu-burger.component.html',
  styleUrls: ['./menu-burger.component.scss'],
  standalone: true,
  imports: [IonAvatar, NgFor, NgIf, SafeHtmlPipe, MediaUrlPipe, AsyncPipe]
})
export class MenuBurgerComponent {

  @Input() isOpen: boolean = false;
  @Input() isCollapsed: boolean = false;
  @Input() avatar!:string;
  @Input() theme: 'dark' | 'light' = 'dark';
  @Input() activeItemIndex: number = 2; // Ajout de l'input pour l'item actif
  @Output() activeItemChange = new EventEmitter<NavItem>();
  @Output() closeMenu = new EventEmitter<void>();
 
  navItems: NavItem[] = [
    {
      idx: 0,
      page: 'challenges',
      label: 'Challenges',
      emoji: '⭐',
      route: '/challenges',
      iconPath: `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`,
    },
    {
      idx: 1,
      page: 'explorez',
      label: 'Explorez',
      emoji: '✨',
      route: '/explorez',
      iconPath: `<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>`,
    },
    {
      idx: 2,
      page: 'suivis',
      label: 'Suivis',
      emoji: '👥',
      route: '/suivis',
      iconPath: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
    },
    {
      idx: 3,
      page: 'messages',
      label: 'Messages',
      emoji: '💬',
      route: '/messages',
      iconPath: `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`,
    },
    {
      idx: 4,
      page: 'publier',
      label: 'Publier',
      emoji: '✨',
      route: '/upload',
      iconPath: `<path d="M15 4l5 5-9.5 9.5-5-5L15 4z"/><line x1="4" y1="20" x2="9" y2="15"/>`,
      visible: true
    }
  ];
 
  constructor(private router: Router) {
    this.updateBadges();
  }
 
  @Input() set unreadCount(value: number | undefined) {
    const messagesItem = this.navItems.find(item => item.page === 'messages');
    if (messagesItem) {
      messagesItem.badge = value && value > 0 ? value : undefined;
    }
  }
 
  @Input() set allowedToExclusive(value: boolean | undefined) {
    const publicationItem = this.navItems.find(item => item.page === 'publier');
    if (publicationItem) {
      publicationItem.star = value && value == true ? value : undefined;
    }
  }
 
  @Input() set canPublish(value: boolean) {
  const publicationItem = this.navItems.find(item => item.page === 'publier');
  if (publicationItem) {
    publicationItem.visible = value ? true : undefined;
  }
}

  private updateBadges() {
    // Met à jour les badges selon les inputs
  }
 
  onNavItemClick(item: NavItem) {
    this.router.navigate([item.route]);
    this.activeItemChange.emit(item);
    this.closeMenu.emit();
  }
 
  gotoprofile() {
    this.router.navigate(['/profile', '']);
    this.closeMenu.emit();
  }
 
  onImageAvatarError(event: any) {
    const imgElement = event.target as HTMLImageElement;
    imgElement.onerror = null;
    imgElement.src = 'assets/avatar-default.png';
    imgElement.classList.add('is-default');
  }

  @HostBinding('class.theme-light') get isLight() { return this.theme === 'light'; }
  @HostBinding('class.theme-dark')  get isDark()  { return this.theme === 'dark'; }

}
