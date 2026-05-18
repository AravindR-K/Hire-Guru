import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

export interface ViolationLog {
  type: 'fullscreen_exit' | 'tab_switch' | 'window_blur' | 'visibility_hidden';
  timestamp: Date;
  message: string;
}

export interface AntiCheatWarning {
  title: string;
  message: string;
  violationCount: number;
  isAutoSubmit: boolean;
}

@Injectable({ providedIn: 'root' })
export class AntiCheatService implements OnDestroy {

  private readonly MAX_VIOLATIONS = 3;
  private violationCount = 0;
  private isActive = false;
  private isFullscreen = false;
  private hasSubmitted = false;

  /** Debounce guard — prevents burst events (e.g., ESC + fullscreenchange firing twice) */
  private lastViolationTime = 0;
  private readonly DEBOUNCE_MS = 1500;

  readonly violationLogs: ViolationLog[] = [];

  /** Emits warning data for the component to show a modal */
  readonly warning$ = new Subject<AntiCheatWarning>();

  /** Emits true when the quiz should be auto-submitted */
  readonly autoSubmit$ = new Subject<void>();

  /** Emits live violation count */
  readonly violationCount$ = new BehaviorSubject<number>(0);

  // ---- Bound listener refs for cleanup ----
  private onFullscreenChange = this.handleFullscreenChange.bind(this);
  private onVisibilityChange = this.handleVisibilityChange.bind(this);
  private onWindowBlur = this.handleWindowBlur.bind(this);

  // ─────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────

  ngOnDestroy(): void {
    this.stop();
  }

  // ─────────────────────────────────────────────
  // Start / Stop
  // ─────────────────────────────────────────────

  start(): void {
    if (this.isActive) return;
    this.isActive = true;
    this.violationCount = 0;
    this.hasSubmitted = false;
    this.violationLogs.length = 0;
    this.violationCount$.next(0);

    document.addEventListener('fullscreenchange', this.onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', this.onFullscreenChange);
    document.addEventListener('mozfullscreenchange', this.onFullscreenChange);
    document.addEventListener('msfullscreenchange', this.onFullscreenChange);

    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('blur', this.onWindowBlur);
  }

  stop(): void {
    this.isActive = false;
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', this.onFullscreenChange);
    document.removeEventListener('mozfullscreenchange', this.onFullscreenChange);
    document.removeEventListener('msfullscreenchange', this.onFullscreenChange);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('blur', this.onWindowBlur);
  }

  reset(): void {
    this.stop();
    this.violationCount = 0;
    this.hasSubmitted = false;
    this.violationLogs.length = 0;
    this.isFullscreen = false;
    this.violationCount$.next(0);
  }

  // ─────────────────────────────────────────────
  // Fullscreen API
  // ─────────────────────────────────────────────

  requestFullscreen(element: HTMLElement = document.documentElement): Promise<void> {
    const el: any = element;
    if (el.requestFullscreen) return el.requestFullscreen();
    if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
    if (el.mozRequestFullScreen) return el.mozRequestFullScreen();
    if (el.msRequestFullscreen) return el.msRequestFullscreen();
    return Promise.reject('Fullscreen API not supported');
  }

  get isCurrentlyFullscreen(): boolean {
    return !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );
  }

  // ─────────────────────────────────────────────
  // Event Handlers
  // ─────────────────────────────────────────────

  private handleFullscreenChange(): void {
    if (!this.isActive) return;

    const nowFullscreen = this.isCurrentlyFullscreen;

    // Transition: was fullscreen → no longer fullscreen = exit
    if (this.isFullscreen && !nowFullscreen) {
      this.recordViolation('fullscreen_exit', 'Exited fullscreen mode');
    }

    this.isFullscreen = nowFullscreen;
  }

  private handleVisibilityChange(): void {
    if (!this.isActive) return;
    if (document.visibilityState === 'hidden') {
      this.recordViolation('tab_switch', 'Switched to another tab or minimized the browser');
    }
  }

  private handleWindowBlur(): void {
    if (!this.isActive) return;
    // Only fire if document is still visible (tab switch already caught it)
    if (document.visibilityState === 'visible') {
      this.recordViolation('window_blur', 'Switched to another application or window');
    }
  }

  // ─────────────────────────────────────────────
  // Core violation logic
  // ─────────────────────────────────────────────

  private recordViolation(type: ViolationLog['type'], message: string): void {
    if (this.hasSubmitted) return;

    // Debounce burst events
    const now = Date.now();
    if (now - this.lastViolationTime < this.DEBOUNCE_MS) return;
    this.lastViolationTime = now;

    this.violationCount++;
    this.violationCount$.next(this.violationCount);

    const log: ViolationLog = { type, timestamp: new Date(), message };
    this.violationLogs.push(log);

    const remaining = this.MAX_VIOLATIONS - this.violationCount;
    const isAutoSubmit = this.violationCount >= this.MAX_VIOLATIONS;

    const warning: AntiCheatWarning = {
      title: isAutoSubmit ? '🚫 Quiz Auto-Submitted' : '⚠️ Warning — Suspicious Activity Detected',
      message: isAutoSubmit
        ? `You have exceeded the maximum number of violations (${this.MAX_VIOLATIONS}). Your quiz has been automatically submitted.`
        : `${message}. This is violation ${this.violationCount} of ${this.MAX_VIOLATIONS}. ${remaining} warning${remaining === 1 ? '' : 's'} remaining before automatic submission.`,
      violationCount: this.violationCount,
      isAutoSubmit
    };

    this.warning$.next(warning);

    if (isAutoSubmit) {
      this.hasSubmitted = true;
      this.stop();
      // Slight delay so the modal renders before submit fires
      setTimeout(() => this.autoSubmit$.next(), 800);
    }
  }

  markSubmitted(): void {
    this.hasSubmitted = true;
    this.stop();
  }

  getViolationCount(): number {
    return this.violationCount;
  }

  getMaxViolations(): number {
    return this.MAX_VIOLATIONS;
  }
}
