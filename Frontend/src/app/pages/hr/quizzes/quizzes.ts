import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { QuizService } from '../../../services/quiz.service';

@Component({
  selector: 'app-hr-quizzes',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './quizzes.html',
  styleUrl: './quizzes.css'
})
export class HRQuizzesComponent implements OnInit {
  quizzes = signal<any[]>([]);
  loading = signal(true);
  error = signal('');

  /** Currently expanded category — null = showing category groups */
  selectedCategory = signal<string | null>(null);

  showEditPopup = signal(false);
  editQuizForm = {
    _id: '',
    title: '',
    timer: 10,
    difficulty: 'medium',
    category: ''
  };
  savingPopup = signal(false);

  constructor(private quizService: QuizService, private router: Router) {}

  ngOnInit(): void {
    this.loadQuizzes();
  }

  loadQuizzes(): void {
    this.loading.set(true);
    this.quizService.getHRQuizzes().subscribe({
      next: (res) => { this.quizzes.set(res.quizzes); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  /** All unique categories sorted alphabetically */
  categories = computed<string[]>(() => {
    const cats = new Set(this.quizzes().map((q: any) => q.category || 'Uncategorized'));
    return Array.from(cats).sort((a, b) => a.localeCompare(b));
  });

  /** Category summary cards: name + count + difficulties present */
  categoryGroups = computed(() => {
    return this.categories().map(cat => {
      const quizzesInCat = this.quizzes().filter((q: any) => (q.category || 'Uncategorized') === cat);
      const diffs = [...new Set(quizzesInCat.map((q: any) => (q.difficulty || 'General').toLowerCase()))];
      const totalAttempts = quizzesInCat.reduce((sum: number, q: any) => sum + (q.attemptCount || 0), 0);
      return { name: cat, count: quizzesInCat.length, difficulties: diffs, totalAttempts };
    });
  });

  /** Quizzes filtered by currently selected category */
  filteredQuizzes = computed<any[]>(() => {
    const cat = this.selectedCategory();
    if (!cat) return [];
    return this.quizzes().filter((q: any) => (q.category || 'Uncategorized') === cat);
  });

  selectCategory(cat: string): void {
    this.selectedCategory.set(cat);
  }

  clearCategory(): void {
    this.selectedCategory.set(null);
  }

  getDifficultyClass(d: string): string {
    switch (d?.toLowerCase()) {
      case 'easy': return 'badge-success';
      case 'medium': return 'badge-warning';
      case 'hard': return 'badge-danger';
      default: return 'badge-primary';
    }
  }

  getDifficultyLabel(d: string): string {
    const map: Record<string, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
    return map[d?.toLowerCase()] || d || 'General';
  }

  getCategoryIcon(cat: string): string {
    const lower = cat.toLowerCase();
    if (lower.includes('java') && !lower.includes('javascript')) return 'coffee';
    if (lower.includes('javascript') || lower.includes('js')) return 'javascript';
    if (lower.includes('python')) return 'terminal';
    if (lower.includes('web') || lower.includes('html') || lower.includes('css')) return 'web';
    if (lower.includes('mern') || lower.includes('mean') || lower.includes('stack')) return 'layers';
    if (lower.includes('angular') || lower.includes('react') || lower.includes('vue')) return 'dashboard';
    if (lower.includes('aptitude') || lower.includes('general')) return 'psychology';
    if (lower.includes('data') || lower.includes('sql') || lower.includes('database')) return 'database';
    if (lower.includes('ai') || lower.includes('ml') || lower.includes('artificial')) return 'smart_toy';
    if (lower.includes('operating') || lower.includes('os')) return 'memory';
    if (lower.includes('network')) return 'lan';
    if (lower.includes('cloud')) return 'cloud';
    return 'quiz';
  }

  getCategoryColor(index: number): string {
    const colors = [
      '#4f6ef7', '#7c5cfc', '#06b6d4', '#22c55e',
      '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6',
      '#f97316', '#ec4899', '#64748b', '#0ea5e9'
    ];
    return colors[index % colors.length];
  }

  openEditPopup(quiz: any): void {
    this.editQuizForm = {
      _id: quiz._id,
      title: quiz.title,
      timer: quiz.timer,
      difficulty: quiz.difficulty,
      category: quiz.category
    };
    this.showEditPopup.set(true);
  }

  closeEditPopup(): void {
    this.showEditPopup.set(false);
  }

  saveBasicChanges(): void {
    this.savingPopup.set(true);
    this.quizService.updateHRQuiz(this.editQuizForm._id, this.editQuizForm).subscribe({
      next: () => {
        this.savingPopup.set(false);
        this.closeEditPopup();
        this.loadQuizzes();
      },
      error: (err) => {
        this.savingPopup.set(false);
        this.error.set(err.error?.message || 'Failed to save changes');
        setTimeout(() => this.error.set(''), 3000);
      }
    });
  }

  deleteQuiz(quizId: string): void {
    if (!confirm('Are you sure you want to delete this quiz?')) return;
    this.quizService.deleteHRQuiz(quizId).subscribe({
      next: () => this.loadQuizzes(),
      error: (err) => this.error.set(err.error?.message || 'Cannot delete quiz')
    });
  }

  editQuestions(): void {
    this.router.navigate(['/hr/quiz', this.editQuizForm._id, 'edit'], {
      state: { quizOverrides: { ...this.editQuizForm } }
    });
    this.closeEditPopup();
  }
}
