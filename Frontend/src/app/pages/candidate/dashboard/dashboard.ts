import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
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

  constructor(public authService: AuthService, private quizService: QuizService) {}

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
