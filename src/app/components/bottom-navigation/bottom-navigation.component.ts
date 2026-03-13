import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, Output, EventEmitter } from '@angular/core';
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
      iconPath: `<path d="M15 4l5 5-9.5 9.5-5-5L15 4z"/><line x1="4" y1="20" x2="9" y2="15"/>`,
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
      badge: 4,
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

  activeIdx: number = 1; // Explorez par défaut
  activeItem: NavItem = this.navItems[1];

  // Output pour envoyer l'activeItem au parent
  @Output() activeItemChange = new EventEmitter<NavItem>();

  // DOM state
  private offsetX: number = 0;
  private dragStart: number | null = null;
  private startOffset: number = 0;
  private velocity: number = 0;
  private lastX: number = 0;
  private lastT: number = 0;
  private animated: boolean = false;

  // Layout constants
  private readonly ITEM_W = 90;
  private NAV_W = 390;
  private CIRCLE_X = 195;

  // Bound event handlers (for cleanup)
  private onMouseMove!: (e: MouseEvent) => void;
  private onMouseUp!: () => void;
  private onTouchMove!: (e: TouchEvent) => void;
  private onTouchEnd!: () => void;

  constructor(private router: Router) {}

  ngOnInit() {
    this.activeItem = this.navItems[this.activeIdx];
  }

  ngAfterViewInit() {
    // Measure actual nav width
    const track = this.navTrackRef.nativeElement;
    this.NAV_W = track.offsetWidth || 390;
    this.CIRCLE_X = this.NAV_W / 2;

    // Init position
    this.offsetX = this.CIRCLE_X - this.activeIdx * this.ITEM_W - this.ITEM_W / 2;
    this.applyTransform(false);

    // Bind global events
    this.onMouseMove = (e: MouseEvent) => this.pointerMove(e.clientX);
    this.onMouseUp   = () => this.pointerUp();
    this.onTouchMove = (e: TouchEvent) => { e.preventDefault(); this.pointerMove(e.touches[0].clientX); };
    this.onTouchEnd  = () => this.pointerUp();

    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup',   this.onMouseUp);
  }

  ngOnDestroy() {
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup',   this.onMouseUp);
  }

  // ── Strip transform ──
  private applyTransform(animated: boolean) {
    const strip = this.navStripRef.nativeElement;
    strip.style.transition = animated
      ? 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      : 'none';
    strip.style.transform = `translateX(${this.offsetX}px)`;
  }

  private snapToIndex(idx: number) {
    idx = Math.max(0, Math.min(idx, this.navItems.length - 1));
    this.offsetX = this.CIRCLE_X - idx * this.ITEM_W - this.ITEM_W / 2;
    this.applyTransform(true);

    if (idx !== this.activeIdx) {
      this.activeIdx  = idx;
      this.activeItem = this.navItems[idx];
      
      // Émettre l'activeItem vers le parent
      this.activeItemChange.emit(this.activeItem);
      
      this.triggerSnapPulse();
    }
  }

  private triggerSnapPulse() {
    const portal = this.circlePortalRef.nativeElement;
    portal.classList.remove('snapped');
    void portal.offsetWidth;
    portal.classList.add('snapped');
  }

  // ── Pointer events ──
  onPointerDown(clientX: number) {
    this.dragStart   = clientX;
    this.startOffset = this.offsetX;
    this.velocity    = 0;
    this.lastX       = clientX;
    this.lastT       = Date.now();
    this.applyTransform(false);
    this.navTrackRef.nativeElement.classList.add('dragging');
  }

  private pointerMove(clientX: number) {
    if (this.dragStart === null) return;

    const now = Date.now();
    this.velocity = (clientX - this.lastX) / (now - this.lastT + 1);
    this.lastX    = clientX;
    this.lastT    = now;

    const dx = clientX - this.dragStart;
    let newOffset = this.startOffset + dx;

    // Resistance near snap point
    const nearIdx    = Math.round((this.CIRCLE_X - newOffset - this.ITEM_W / 2) / this.ITEM_W);
    const nearCenter = this.CIRCLE_X - nearIdx * this.ITEM_W - this.ITEM_W / 2;
    const dist       = Math.abs(newOffset - nearCenter);
    if (dist < 20) {
      newOffset = nearCenter + (newOffset - nearCenter) * 0.35;
    }

    this.offsetX = newOffset;
    this.applyTransform(false);

    // Live update
    const liveIdx = Math.round((this.CIRCLE_X - newOffset - this.ITEM_W / 2) / this.ITEM_W);
    if (liveIdx !== this.activeIdx && liveIdx >= 0 && liveIdx < this.navItems.length) {
      this.activeIdx  = liveIdx;
      this.activeItem = this.navItems[liveIdx];
      
      // Émettre l'activeItem vers le parent pendant le drag
      this.activeItemChange.emit(this.activeItem);
    }
  }

  private pointerUp() {
    if (this.dragStart === null) return;
    this.dragStart = null;
    this.navTrackRef.nativeElement.classList.remove('dragging');

    const projected = this.offsetX + this.velocity * 80;
    const targetIdx = Math.round((this.CIRCLE_X - projected - this.ITEM_W / 2) / this.ITEM_W);
    this.snapToIndex(targetIdx);
  }

  // ── Mouse handlers (template) ──
  onMouseDown(e: MouseEvent) { this.onPointerDown(e.clientX); }

  // ── Touch handlers (template) ──
  onTouchStart(e: TouchEvent) { this.onPointerDown(e.touches[0].clientX); }
  onTouchMoveLocal(e: TouchEvent) { e.preventDefault(); this.pointerMove(e.touches[0].clientX); }
  onTouchEndLocal() { this.pointerUp(); }

  // ── Circle action button ──
  onCircleAction() {
    // Navigate to dedicated action page — customize as needed
    this.router.navigate(['/action']);
  }

  // ── Helpers for template ──
  isCapture(item: NavItem): boolean { return item.idx === this.activeIdx; }
  isNear(item: NavItem): boolean    { return Math.abs(item.idx - this.activeIdx) === 1; }
}
