import { Component, OnInit, OnDestroy, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { QuizService } from '../../../services/quiz.service';

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

  timeLeft = signal<number>(0);
  timerInterval: any;
  startTime = 0;

  loading = signal(true);
  submitting = signal(false);
  error = signal('');
  submitted = signal(false);

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
    private quizService: QuizService
  ) {}

  ngOnInit(): void {
    const quizId = this.route.snapshot.params['quizId'];
    this.loadQuiz(quizId);
  }

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  loadQuiz(quizId: string): void {
    this.quizService.getQuizForTaking(quizId).subscribe({
      next: (res) => {
        this.quiz.set(res.quiz);
        this.questions.set(res.questions);
        this.timeLeft.set(res.quiz.timer * 60);
        this.startTime = Date.now();
        this.loading.set(false);
        this.startTimer();
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

  goTo(index: number): void {
    if (index >= 0 && index < this.questions().length) this.currentIndex.set(index);
  }

  prev(): void { this.goTo(this.currentIndex() - 1); }
  next(): void { this.goTo(this.currentIndex() + 1); }

  scrollDots(direction: number): void {
    const el = this.dotsContainer?.nativeElement;
    if (el) el.scrollBy({ left: direction * 120, behavior: 'smooth' });
  }

  submitQuiz(): void {
    if (this.submitting() || this.submitted()) return;
    this.submitting.set(true);
    this.error.set('');
    clearInterval(this.timerInterval);

    const timeTaken = Math.round((Date.now() - this.startTime) / 1000);
    const answersArray = Array.from(this.answers().entries()).map(([questionId, selectedAnswers]) => ({
      questionId, selectedAnswers
    }));

    this.quizService.submitQuiz(this.quiz().id, answersArray, timeTaken).subscribe({
      next: () => {
        this.submitted.set(true);
        this.submitting.set(false);
        setTimeout(() => this.router.navigate(['/candidate/dashboard']), 2000);
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err.error?.message || 'Failed to submit quiz');
      }
    });
  }
}
