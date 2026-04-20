import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, Output, EventEmitter, Input, HostBinding, ChangeDetectorRef } from '@angular/core';
import { SafeHtmlPipe } from './safe-html.pipe';
import { Router } from '@angular/router';
import { NgFor, NgIf} from '@angular/common';

interface NavItem {
  idx: number;
  page: string;
  label: string;
  emoji: string;
  route: string;
  iconPath: string;
  badge?: number;
  star?: boolean;
  visible?:boolean;
}

@Component({
  selector: 'app-bottom-navigation',
  templateUrl: './bottom-navigation.component.html',
  styleUrls: ['./bottom-navigation.component.scss'],
  imports: [NgFor,NgIf, SafeHtmlPipe]
})
export class BottomNavigationComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('navStrip') navStripRef!: ElementRef<HTMLElement>;
  @ViewChild('navTrack') navTrackRef!: ElementRef<HTMLElement>;
  @ViewChild('circlePortal') circlePortalRef!: ElementRef<HTMLElement>;

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
    }
  ];

  activeIdx: number = 1;
  activeItem: NavItem = this.navItems[1];

  @Output() activeItemChange = new EventEmitter<NavItem>();

  @Input() set theme(value: 'dark' | 'light') {
    this._theme = value;
  }
  get theme(): 'dark' | 'light' { return this._theme; }
  private _theme: 'dark' | 'light' = 'dark';

  @Input() set unreadCount(value: number | undefined) {
    const messagesItem = this.navItems.find(item => item.page === 'messages');
    if (messagesItem) {
      messagesItem.badge = value && value > 0 ? value : undefined;
    }
  }

  @Input() set allowedToExclusive(value: boolean | undefined){
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

  @HostBinding('class.theme-light') get isLight() { return this._theme === 'light'; }
  @HostBinding('class.theme-dark')  get isDark()  { return this._theme === 'dark'; }

  // DOM state
  private offsetX: number = 0;
  private dragStart: number | null = null;
  private startOffset: number = 0;
  private velocity: number = 0;
  private lastX: number = 0;
  private lastT: number = 0;

  // 🔥 Long press detection
  private longPressTimer: any = null;
  private isDraggingEnabled: boolean = false;
  private tapStartX: number = 0;
  private tapStartY: number = 0;
  private readonly LONG_PRESS_DURATION = 200; // ms - comme Snapchat
  private readonly TAP_MOVE_THRESHOLD = 8; // px

  // Layout constants
  private readonly ITEM_W = 90;
  private NAV_W = 390;
  private CIRCLE_X = 195;

  // Bound event handlers
  private onMouseMove!: (e: MouseEvent) => void;
  private onMouseUp!: () => void;
  private onTouchMove!: (e: TouchEvent) => void;
  private onTouchEnd!: () => void;

  constructor(private router: Router, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.activeItem = this.navItems[this.activeIdx];
  }

  isLoading = true;

  ngAfterViewInit() {
    setTimeout(() => {
      const track = this.navTrackRef.nativeElement;
      this.NAV_W = track.offsetWidth || 390;
      this.CIRCLE_X = this.NAV_W / 2;

      if (this.NAV_W > 0) {
        this.offsetX = this.CIRCLE_X - this.activeIdx * this.ITEM_W - this.ITEM_W / 2;
        this.applyTransform(false);
      }

      this.isLoading = false;
      this.cdr.markForCheck();
      
      this.onMouseMove = (e: MouseEvent) => this.pointerMove(e.clientX, e.clientY);
      this.onMouseUp   = () => this.pointerUp();
      this.onTouchMove = (e: TouchEvent) => { 
        this.pointerMove(e.touches[0].clientX, e.touches[0].clientY); 
      };
      this.onTouchEnd  = () => this.pointerUp();

      window.addEventListener('mousemove', this.onMouseMove);
      window.addEventListener('mouseup',   this.onMouseUp);
    }, 50);
  }

  ngOnDestroy() {
    this.clearLongPressTimer();
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup',   this.onMouseUp);
  }

  private applyTransform(animated: boolean) {
    const strip = this.navStripRef.nativeElement;
    strip.style.transition = animated
      ? 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      : 'none';
    strip.style.transform = `translateX(${this.offsetX}px)`;
  }

  private snapToIndex(idx: number) {
    idx = Math.max(0, Math.min(idx, this.navItems.length - 1));
    
    const targetOffset = this.CIRCLE_X - idx * this.ITEM_W - this.ITEM_W / 2;
    this.smoothScrollToOffset(targetOffset, idx);
  }

  private smoothScrollToOffset(targetOffset: number, targetIdx: number) {
    const startOffset = this.offsetX;
    const distance = targetOffset - startOffset;
    const duration = 300;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = this.easeOutCubic(progress);
      
      this.offsetX = startOffset + distance * easedProgress;
      this.applyTransform(false);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        if (targetIdx !== this.activeIdx) {
          this.activeIdx = targetIdx;
          this.activeItem = this.navItems[targetIdx];
          this.activeItemChange.emit(this.activeItem);
          this.triggerSnapPulse();
        }
      }
    };

    requestAnimationFrame(animate);
  }

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  private triggerSnapPulse() {
    const portal = this.circlePortalRef.nativeElement;
    portal.classList.remove('snapped');
    void portal.offsetWidth;
    portal.classList.add('snapped');
  }

  // 🔥 NOUVEAU : Clear timer
  private clearLongPressTimer() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  // 🔥 NOUVEAU : Activer le mode drag après long press
  private enableDragMode() {
    this.isDraggingEnabled = true;
    this.navTrackRef.nativeElement.classList.add('dragging');
    
    // Feedback haptique si disponible
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  }

  // 🔥 MODIFIÉ : Démarrer le timer de long press
  onPointerDown(clientX: number, clientY: number) {
    this.tapStartX = clientX;
    this.tapStartY = clientY;
    this.dragStart = clientX;
    this.startOffset = this.offsetX;
    this.velocity = 0;
    this.lastX = clientX;
    this.lastT = Date.now();
    this.isDraggingEnabled = false;

    // Démarrer le timer de long press
    this.clearLongPressTimer();
    this.longPressTimer = setTimeout(() => {
      this.enableDragMode();
    }, this.LONG_PRESS_DURATION);
  }

  // 🔥 MODIFIÉ : N'autoriser le drag que si activé
  private pointerMove(clientX: number, clientY: number) {
    if (this.dragStart === null) return;

    // Calculer le mouvement depuis le début
    const deltaX = Math.abs(clientX - this.tapStartX);
    const deltaY = Math.abs(clientY - this.tapStartY);
    const totalMovement = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Si mouvement significatif avant la fin du timer, annuler le long press
    if (!this.isDraggingEnabled && totalMovement > this.TAP_MOVE_THRESHOLD) {
      this.clearLongPressTimer();
      return; // Ne pas drag
    }

    // Si le drag n'est pas activé, ne rien faire
    if (!this.isDraggingEnabled) return;

    const now = Date.now();
    this.velocity = (clientX - this.lastX) / (now - this.lastT + 1);
    this.lastX = clientX;
    this.lastT = now;

    const dx = clientX - this.dragStart;
    let newOffset = this.startOffset + dx;

    // Resistance near snap point
    const nearIdx = Math.round((this.CIRCLE_X - newOffset - this.ITEM_W / 2) / this.ITEM_W);
    const nearCenter = this.CIRCLE_X - nearIdx * this.ITEM_W - this.ITEM_W / 2;
    const dist = Math.abs(newOffset - nearCenter);
    if (dist < 20) {
      newOffset = nearCenter + (newOffset - nearCenter) * 0.35;
    }

    this.offsetX = newOffset;
    this.applyTransform(false);

    // Live update
    const liveIdx = Math.round((this.CIRCLE_X - newOffset - this.ITEM_W / 2) / this.ITEM_W);
    if (liveIdx !== this.activeIdx && liveIdx >= 0 && liveIdx < this.navItems.length) {
      this.activeIdx = liveIdx;
      this.activeItem = this.navItems[liveIdx];
      this.activeItemChange.emit(this.activeItem);
    }
  }

  // 🔥 MODIFIÉ : Gérer tap vs drag
  private pointerUp() {
    this.clearLongPressTimer();

    if (this.dragStart === null) return;

    const wasDragging = this.isDraggingEnabled;
    
    this.dragStart = null;
    this.isDraggingEnabled = false;
    this.navTrackRef.nativeElement.classList.remove('dragging');

    if (wasDragging) {
      
      // C'était un drag, faire le snap
      const projected = this.offsetX + this.velocity * 80;
      const targetIdx = Math.round((this.CIRCLE_X - projected - this.ITEM_W / 2) / this.ITEM_W);
      console.log(targetIdx);
      this.snapToIndex(targetIdx);
      
    } else {
      // C'était un tap rapide, trouver l'item cliqué
      const clickedIdx = Math.round((this.CIRCLE_X - this.offsetX - this.ITEM_W / 2) / this.ITEM_W);
      if (clickedIdx >= 0 && clickedIdx < this.navItems.length) {
        const clickedItem = this.navItems[clickedIdx];
        console.log(clickedIdx);
        this.snapToIndex(clickedIdx+1);
        //this.onNavItemClick(clickedItem);
      }
    }
  }

  // 🔥 SIMPLIFIÉ : Plus besoin de vérification complexe
  onNavItemClick(item: NavItem) {
    console.log("Navigation vers:", item.route);
    this.snapToIndex(item.idx);
  }

  // ── Mouse handlers ──
  onMouseDown(e: MouseEvent) { 
    this.onPointerDown(e.clientX, e.clientY); 
  }

  // ── Touch handlers ──
  onTouchStart(e: TouchEvent) { 
    this.onPointerDown(e.touches[0].clientX, e.touches[0].clientY); 
  }
  
  onTouchMoveLocal(e: TouchEvent) { 
    // Prévenir le scroll seulement si le drag est activé
    if (this.isDraggingEnabled) {
      e.preventDefault(); 
    }
    this.pointerMove(e.touches[0].clientX, e.touches[0].clientY); 
  }
  
  onTouchEndLocal() { 
    this.pointerUp(); 
  }

  // ── Helpers ──
  isCapture(item: NavItem): boolean { return item.idx === this.activeIdx; }
  isNear(item: NavItem): boolean { return Math.abs(item.idx - this.activeIdx) === 1; }
}