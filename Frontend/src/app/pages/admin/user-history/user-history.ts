import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { QuizService } from '../../../services/quiz.service';

@Component({
  selector: 'app-user-history',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './user-history.html',
  styleUrl: './user-history.css'
})
export class UserHistoryComponent implements OnInit {
  userId = '';
  user = signal<any>(null);
  submissions = signal<any[]>([]);
  loading = signal<boolean>(true);
  currentLevel = signal<string>('beginner');
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  levels = [
    { value: 'beginner', label: 'Fresher' },
    { value: 'intermediate', label: 'Intern' },
    { value: 'advanced', label: 'Intermediate' },
    { value: 'expert', label: 'Expert' }
  ];

  constructor(
    private route: ActivatedRoute,
    public authService: AuthService,
    private quizService: QuizService
  ) {}

  ngOnInit(): void {
    this.userId = this.route.snapshot.params['userId'];
    this.loadHistory();
  }

  loadHistory(): void {
    this.quizService.getUserHistory(this.userId).subscribe({
      next: (res) => {
        this.user.set(res.user);
        this.currentLevel.set(res.user.level || 'beginner');
        this.submissions.set(res.submissions);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  changeLevel(newLevel: string): void {
    if (newLevel === this.currentLevel()) return;

    const previousLevel = this.currentLevel();
    const userRole = this.authService.currentUser()?.role || 'admin';

    this.quizService.updateUserLevel(this.userId, newLevel, userRole).subscribe({
      next: (res) => {
        this.currentLevel.set(newLevel);
        this.showToast(
          `Level changed from ${this.capitalize(res.previousLevel)} to ${this.capitalize(res.newLevel)}`,
          'success'
        );
      },
      error: (err) => {
        this.showToast(err.error?.message || 'Failed to update level', 'error');
      }
    });
  }

  private showToast(message: string, type: 'success' | 'error'): void {
    this.toast.set({ message, type });
    setTimeout(() => this.toast.set(null), 3500);
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }

  getComfortLevel(topic: string): string {
    const u = this.user();
    if (!u || !u.topicsOfInterest || !topic) return 'N/A';
    
    const interest = u.topicsOfInterest.find((t: any) => t.topic.toLowerCase() === topic.toLowerCase());
    return interest ? `${interest.comfortLevel}%` : 'N/A';
  }

  logout(): void {
    this.authService.logout();
  }

  getResumeUrl(resumePath: string): string {
    if (!resumePath) return '';
    return `http://localhost:5000${resumePath}`;
  }
}
