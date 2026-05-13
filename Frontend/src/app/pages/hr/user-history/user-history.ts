import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { QuizService } from '../../../services/quiz.service';

@Component({
  selector: 'app-hr-user-history',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './user-history.html',
  styleUrl: './user-history.css'
})
export class HRUserHistoryComponent implements OnInit {
  userId = '';
  user = signal<any>(null);
  interviews = signal<any[]>([]);
  // The interview the user has drilled into
  selectedInterview = signal<any>(null);
  // Submissions for the selected interview's quizzes
  submissions = signal<any[]>([]);
  loadingInterviews = signal<boolean>(true);
  loadingSubmissions = signal<boolean>(false);

  currentLevel = signal<string>('beginner');
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  // Expose String for template
  readonly String = String;

  levels = [
    { value: 'beginner', label: 'Fresher' },
    { value: 'intermediate', label: 'Intern' },
    { value: 'advanced', label: 'Intermediate' },
    { value: 'expert', label: 'Expert' }
  ];

  /** Difficulty → level code mapping */
  private levelCodeMap: Record<string, string> = {
    easy: 'BEG',
    medium: 'INT',
    hard: 'ADV'
  };

  constructor(
    private route: ActivatedRoute,
    public authService: AuthService,
    private quizService: QuizService
  ) {}

  ngOnInit(): void {
    this.userId = this.route.snapshot.params['userId'];
    this.loadInterviews();
  }

  loadInterviews(): void {
    this.loadingInterviews.set(true);
    this.quizService.getUserInterviews(this.userId).subscribe({
      next: (res) => {
        this.user.set(res.user);
        this.currentLevel.set(res.user.level || 'beginner');
        this.interviews.set(res.interviews);
        this.loadingInterviews.set(false);
      },
      error: () => this.loadingInterviews.set(false)
    });
  }

  selectInterview(interview: any): void {
    this.selectedInterview.set(interview);
    // Load submissions for the quizzes in this interview
    this.loadingSubmissions.set(true);
    this.quizService.getUserHistory(this.userId).subscribe({
      next: (res) => {
        this.submissions.set(res.submissions || []);
        this.loadingSubmissions.set(false);
      },
      error: () => this.loadingSubmissions.set(false)
    });
  }

  goBackToList(): void {
    this.selectedInterview.set(null);
    this.submissions.set([]);
  }

  /** Find submission for a given quizId from the loaded submissions */
  getSubmissionForQuiz(quizId: any): any {
    if (!quizId) return null;
    const qidStr = quizId.toString();
    return this.submissions().find((s: any) =>
      (s.quizId?._id?.toString() || s.quizId?.toString()) === qidStr
    ) || null;
  }

  /** Generate a quiz ID like Q_Aptitude_BEG_001 for a given quiz within an interview */
  getQuizId(interviewQuiz: any, index: number): string {
    const quizData = interviewQuiz.quizId || {};
    const topic = (quizData.category || 'General').replace(/\s+/g, '_');
    const diff = (quizData.difficulty || 'easy').toLowerCase();
    const levelCode = this.levelCodeMap[diff] || 'BEG';
    const seq = String(index + 1).padStart(3, '0');
    return `Q_${topic}_${levelCode}_${seq}`;
  }

  changeLevel(newLevel: string): void {
    if (newLevel === this.currentLevel()) return;

    this.quizService.updateUserLevel(this.userId, newLevel).subscribe({
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

  getStatusClass(status: string): string {
    switch (status) {
      case 'completed': return 'status-done';
      case 'evaluation': return 'status-evaluation';
      default: return 'status-pending';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'completed': return 'Done';
      case 'evaluation': return 'Evaluation';
      case 'coding_phase': return 'Coding Round';
      case 'quiz_phase': return 'Quiz Phase';
      default: return 'Pending';
    }
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

  getResumeUrl(resumePath: string): string {
    if (!resumePath) return '';
    return `http://localhost:5000${resumePath}`;
  }
}
