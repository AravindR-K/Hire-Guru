import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { QuizService } from '../../../services/quiz.service';

@Component({
  selector: 'app-candidate-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class CandidateDashboardComponent implements OnInit {
  interviews = signal<any[]>([]);
  loading = signal(true);
  uploadingCodingId = signal<string | null>(null);

  // ── Pre-quiz Policy Modal ─────────────────────
  showPolicyModal = signal(false);
  policyAccepted = signal(false);
  pendingQuizId = signal<string | null>(null);

  constructor(public authService: AuthService, private quizService: QuizService, private router: Router) {}

  ngOnInit(): void {
    this.loadInterviews();
  }

  loadInterviews(): void {
    this.quizService.getCandidateInterviews().subscribe({
      next: (res) => {
        this.interviews.set(res.interviews);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  /** Called when candidate clicks "Start Assessment" — shows policy modal first */
  openPolicyModal(quizId: string): void {
    this.pendingQuizId.set(quizId);
    this.policyAccepted.set(false);
    this.showPolicyModal.set(true);
  }

  /** Dismiss modal without proceeding */
  closePolicyModal(): void {
    this.showPolicyModal.set(false);
    this.pendingQuizId.set(null);
    this.policyAccepted.set(false);
  }

  /** Navigate to quiz only after policy is accepted */
  beginAssessment(): void {
    const id = this.pendingQuizId();
    if (!id || !this.policyAccepted()) return;
    this.showPolicyModal.set(false);
    this.router.navigate(['/candidate/quiz', id]);
  }

  onCodingZipSelected(event: any, interviewId: string): void {
    const file = event.target.files[0];
    if (file) {
      this.uploadingCodingId.set(interviewId);
      this.quizService.uploadCandidateCodingSubmission(interviewId, file).subscribe({
        next: (res) => {
          this.uploadingCodingId.set(null);
          this.loadInterviews();
          alert('Coding round submitted successfully!');
        },
        error: (err) => {
          this.uploadingCodingId.set(null);
          alert(err.error?.message || 'Failed to submit coding round');
        }
      });
    }
  }
}
