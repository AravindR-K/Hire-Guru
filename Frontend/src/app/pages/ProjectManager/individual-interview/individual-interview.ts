import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QuizService } from '../../../services/quiz.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-pm-individual-interview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './individual-interview.html',
  styleUrl: './individual-interview.css'
})
export class PMIndividualInterviewComponent implements OnInit {
  interviews = signal<any[]>([]);
  loading = signal(true);
  showDetailModal = signal(false);
  selectedInterview = signal<any>(null);

  evalComment = signal('');
  evalRecommendation = signal('');

  stats = signal<any>({ total: 0, pending: 0, completed: 0, accepted: 0, rejected: 0 });
  filterStatus = signal('');
  isSubmitting = signal(false);

  constructor(private quizService: QuizService, public authService: AuthService) {}

  ngOnInit(): void {
    this.loadInterviews();
    this.loadStats();
  }

  loadInterviews(): void {
    this.loading.set(true);
    const params: any = {};
    if (this.filterStatus()) params.status = this.filterStatus();
    params.type = 'individual';

    this.quizService.getInterviews(params).subscribe({
      next: (res) => {
        this.interviews.set(res.interviews || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  loadStats(): void {
    this.quizService.getInterviewStats().subscribe({
      next: (res) => this.stats.set(res)
    });
  }

  openDetail(interview: any): void {
    this.quizService.getInterviewById(interview._id).subscribe({
      next: (res) => {
        this.selectedInterview.set(res.interview);
        this.evalComment.set('');
        this.evalRecommendation.set('');
        this.showDetailModal.set(true);
      }
    });
  }

  closeDetail(): void {
    this.showDetailModal.set(false);
    this.selectedInterview.set(null);
  }

  submitEvaluation(): void {
    const interview = this.selectedInterview();
    if (!interview || !this.evalRecommendation()) return;

    this.isSubmitting.set(true);
    this.quizService.submitEvaluation(interview._id, {
      comments: this.evalComment(),
      recommendation: this.evalRecommendation()
    }).subscribe({
      next: (res) => {
        this.selectedInterview.set(res.interview);
        this.evalComment.set('');
        this.evalRecommendation.set('');
        this.isSubmitting.set(false);
      },
      error: () => this.isSubmitting.set(false)
    });
  }

  onFilterChange(): void {
    this.loadInterviews();
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'pending': return 'badge-warning';
      case 'quiz_phase': return 'badge-info';
      case 'coding_phase': return 'badge-info';
      case 'evaluation': return 'badge-purple';
      case 'completed': return 'badge-success';
      default: return '';
    }
  }

  getDecisionClass(decision: string): string {
    switch (decision) {
      case 'accepted': return 'badge-success';
      case 'rejected': return 'badge-danger';
      case 'on_hold': return 'badge-warning';
      case '2nd_round': return 'badge-info';
      default: return 'badge-muted';
    }
  }

  formatStatus(status: string): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  formatDecision(decision: string): string {
    const map: any = {
      pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected',
      on_hold: 'On Hold', '2nd_round': '2nd Round'
    };
    return map[decision] || decision;
  }

  hasUserEvaluated(): boolean {
    const interview = this.selectedInterview();
    if (!interview) return false;
    const userId = this.authService.currentUser()?.id;
    return interview.evaluations?.some((e: any) => e.evaluatorId?._id === userId);
  }

  getEvaluationByRole(role: string): any {
    const iv = this.selectedInterview();
    if (!iv || !iv.evaluations) return null;
    return iv.evaluations.find((e: any) => e.evaluatorRole === role) || null;
  }

  allEvaluationsDone(): boolean {
    const iv = this.selectedInterview();
    if (!iv) return false;
    const numInterviewers = iv.assignedInterviewers?.length || 0;
    const numHrs = iv.assignedHRs?.length || 0;
    const numPms = iv.assignedPMs?.length || 0;
    const totalExpected = numInterviewers + numHrs + numPms;
    if (totalExpected === 0) return false;
    const numEvaluations = iv.evaluations?.length || 0;
    return numEvaluations >= totalExpected;
  }

  getVisibleEvaluations(evaluations: any[]): any[] {
    if (!evaluations) return [];
    const userId = this.authService.currentUser()?.id;
    return evaluations.filter((e: any) => e.evaluatorId?._id === userId || e.evaluatorId === userId);
  }
}
