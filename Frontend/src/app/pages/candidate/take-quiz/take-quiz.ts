import {
  Component, OnInit, OnDestroy, signal, computed,
  ViewChild, ElementRef, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { QuizService } from '../../../services/quiz.service';
import { AntiCheatService, AntiCheatWarning } from '../../../services/anti-cheat.service';

@Component({
  selector: 'app-take-quiz',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './take-quiz.html',
  styleUrl: './take-quiz.css'
})
export class TakeQuizComponent implements OnInit, OnDestroy {
  quiz = signal<any>(null);
  questions = signal<any[]>([]);
  currentIndex = signal<number>(0);
  answers = signal<Map<string, string[]>>(new Map());

  @ViewChild('dotsContainer') dotsContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('quizContainer') quizContainer!: ElementRef<HTMLDivElement>;

  timeLeft = signal<number>(0);
  timerInterval: any;
  startTime = 0;

  loading = signal(true);
  submitting = signal(false);
  error = signal('');
  submitted = signal(false);

  // ── Anti-cheat state ─────────────────────────────────
  showWarningModal = signal(false);
  currentWarning = signal<AntiCheatWarning | null>(null);
  violationCount = signal(0);
  isFullscreen = signal(false);

  canScrollLeft = signal(false);
  canScrollRight = signal(false);

  private antiCheatSubs: Subscription[] = [];

  // ─────────────────────────────────────────────────────

  currentQuestion = computed(() => this.questions()[this.currentIndex()]);
  progress = computed(() => {
    const total = this.questions().length;
    return total > 0 ? Math.round(((this.currentIndex() + 1) / total) * 100) : 0;
  });

  formattedTime = computed(() => {
    const t = this.timeLeft();
    const m = Math.floor(t / 60);
    const s = t % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private quizService: QuizService,
    public antiCheat: AntiCheatService
  ) {}

  ngOnInit(): void {
    const quizId = this.route.snapshot.params['quizId'];
    this.loadQuiz(quizId);
    this.setupAntiCheat();
  }

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.antiCheatSubs.forEach(s => s.unsubscribe());
    this.antiCheat.stop();
  }

  // ─────────────────────────────────────────────────────
  // Anti-cheat setup
  // ─────────────────────────────────────────────────────

  private setupAntiCheat(): void {
    // Subscribe to warnings
    const warnSub = this.antiCheat.warning$.subscribe((warning: AntiCheatWarning) => {
      this.currentWarning.set(warning);
      this.showWarningModal.set(true);
    });

    // Subscribe to auto-submit trigger
    const submitSub = this.antiCheat.autoSubmit$.subscribe(() => {
      this.submitQuiz(true);
    });

    // Keep violation count in sync
    const countSub = this.antiCheat.violationCount$.subscribe(count => {
      this.violationCount.set(count);
    });

    this.antiCheatSubs.push(warnSub, submitSub, countSub);
  }

  private startAntiCheat(): void {
    this.antiCheat.reset();
    this.antiCheat.start();

    // Enter fullscreen, track state
    this.antiCheat.requestFullscreen().then(() => {
      this.isFullscreen.set(true);
    }).catch(() => {
      // Silently fail if browser denies fullscreen (e.g. Safari without user gesture)
      this.isFullscreen.set(false);
    });
  }

  /** Dismiss warning, re-enter fullscreen if it was a fullscreen exit */
  dismissWarning(): void {
    const warning = this.currentWarning();
    this.showWarningModal.set(false);

    if (warning?.isAutoSubmit) return; // Already submitting

    // Re-request fullscreen after dismissal
    if (!this.antiCheat.isCurrentlyFullscreen) {
      this.antiCheat.requestFullscreen().then(() => {
        this.isFullscreen.set(true);
      }).catch(() => {
        this.isFullscreen.set(false);
      });
    }
  }

  // ─────────────────────────────────────────────────────
  // Quiz lifecycle
  // ─────────────────────────────────────────────────────

  loadQuiz(quizId: string): void {
    this.quizService.getQuizForTaking(quizId).subscribe({
      next: (res) => {
        this.quiz.set(res.quiz);
        this.questions.set(res.questions);
        this.timeLeft.set(res.quiz.timer * 60);
        this.startTime = Date.now();
        this.loading.set(false);
        this.startTimer();
        // Start anti-cheat after quiz loads
        this.startAntiCheat();
        // Scroll active dot into view and initialize scroll buttons
        this.scrollActiveDotIntoView();
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Failed to load quiz');
        this.loading.set(false);
      }
    });
  }

  startTimer(): void {
    this.timerInterval = setInterval(() => {
      const current = this.timeLeft();
      if (current <= 1) {
        clearInterval(this.timerInterval);
        this.timeLeft.set(0);
        this.submitQuiz();
      } else {
        this.timeLeft.set(current - 1);
      }
    }, 1000);
  }

  // ─────────────────────────────────────────────────────
  // Answer management
  // ─────────────────────────────────────────────────────

  selectOption(questionId: string, option: string, type: string): void {
    const currentAnswers = new Map(this.answers());
    if (type === 'mcq') {
      const existing = currentAnswers.get(questionId) || [];
      if (existing.includes(option)) {
        currentAnswers.set(questionId, existing.filter(o => o !== option));
      } else {
        currentAnswers.set(questionId, [...existing, option]);
      }
    } else {
      currentAnswers.set(questionId, [option]);
    }
    this.answers.set(currentAnswers);
  }

  isSelected(questionId: string, option: string): boolean {
    const selected = this.answers().get(questionId);
    return selected ? selected.includes(option) : false;
  }

  isAnswered(index: number): boolean {
    const q = this.questions()[index];
    if (!q) return false;
    const ans = this.answers().get(q._id);
    return !!ans && ans.length > 0;
  }

  // ─────────────────────────────────────────────────────
  // Navigation
  // ─────────────────────────────────────────────────────

  goTo(index: number): void {
    if (index >= 0 && index < this.questions().length) {
      this.currentIndex.set(index);
      this.scrollActiveDotIntoView();
    }
  }

  prev(): void { this.goTo(this.currentIndex() - 1); }
  next(): void { this.goTo(this.currentIndex() + 1); }

  scrollDots(direction: number): void {
    const el = this.dotsContainer?.nativeElement;
    if (el) {
      el.scrollBy({ left: direction * 120, behavior: 'smooth' });
      setTimeout(() => this.updateScrollButtons(), 300);
    }
  }

  updateScrollButtons(): void {
    const el = this.dotsContainer?.nativeElement;
    if (el) {
      // Allow a small tolerance for rounding errors in scroll position
      this.canScrollLeft.set(el.scrollLeft > 1);
      this.canScrollRight.set(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    }
  }

  scrollActiveDotIntoView(): void {
    setTimeout(() => {
      const container = this.dotsContainer?.nativeElement;
      if (!container) return;

      const activeDot = container.querySelector('.dot.active') as HTMLElement;
      if (!activeDot) return;

      const containerWidth = container.clientWidth;
      const dotLeft = activeDot.offsetLeft;
      const dotWidth = activeDot.clientWidth;

      // Center the active dot
      const targetScrollLeft = dotLeft - (containerWidth / 2) + (dotWidth / 2);

      container.scrollTo({
        left: targetScrollLeft,
        behavior: 'smooth'
      });

      // Update buttons after smooth scroll animation is likely finished
      setTimeout(() => this.updateScrollButtons(), 300);
    }, 50);
  }

  // ─────────────────────────────────────────────────────
  // Submission
  // ─────────────────────────────────────────────────────

  submitQuiz(isAutoSubmit = false): void {
    if (this.submitting() || this.submitted()) return;

    this.submitting.set(true);
    this.error.set('');
    clearInterval(this.timerInterval);
    this.antiCheat.markSubmitted();

    const timeTaken = Math.round((Date.now() - this.startTime) / 1000);
    const answersArray = Array.from(this.answers().entries()).map(([questionId, selectedAnswers]) => ({
      questionId, selectedAnswers
    }));

    this.quizService.submitQuiz(this.quiz().id, answersArray, timeTaken, isAutoSubmit).subscribe({
      next: () => {
        this.submitted.set(true);
        this.submitting.set(false);
        // Exit fullscreen cleanly
        if (this.antiCheat.isCurrentlyFullscreen) {
          document.exitFullscreen?.().catch(() => {});
        }
        setTimeout(() => this.router.navigate(['/candidate/dashboard']), 2000);
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err.error?.message || 'Failed to submit quiz');
      }
    });
  }

  getMaxViolations(): number {
    return this.antiCheat.getMaxViolations();
  }
}
