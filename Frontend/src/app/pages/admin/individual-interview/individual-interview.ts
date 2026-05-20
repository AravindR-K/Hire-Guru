import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QuizService } from '../../../services/quiz.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-individual-interview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './individual-interview.html',
  styleUrl: './individual-interview.css'
})
export class IndividualInterviewComponent implements OnInit {
  interviews = signal<any[]>([]);
  loading = signal(true);
  showCreateModal = signal(false);
  showDetailModal = signal(false);
  selectedInterview = signal<any>(null);

  // Create form data
  candidates = signal<any[]>([]);
  interviewers = signal<any[]>([]);
  hrs = signal<any[]>([]);
  pms = signal<any[]>([]);
  quizzes = signal<any[]>([]);

  newInterview = {
    candidateId: '',
    assignedInterviewers: [] as string[],
    assignedHRs: [] as string[],
    assignedPMs: [] as string[],
    position: '',
    techStack: '',
    source: '',
    dateOfInterview: new Date().toISOString().split('T')[0],
    timeOfInterview: '',
    quizIds: [] as string[]
  };

  // Evaluation form
  evalComment = signal('');
  evalRecommendation = signal('');

  // Stats
  stats = signal<any>({ total: 0, pending: 0, completed: 0, accepted: 0, rejected: 0 });

  // Filter
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

  openCreateModal(): void {
    // Load dropdown data
    this.quizService.getInterviewCandidates().subscribe({
      next: (res) => this.candidates.set(res.candidates || [])
    });
    this.quizService.getInterviewers().subscribe({
      next: (res) => {
        const staff = res.interviewers || [];
        this.interviewers.set(staff.filter((s: any) => s.role === 'interviewer'));
        this.pms.set(staff.filter((s: any) => s.role === 'pm'));
        this.hrs.set(staff.filter((s: any) => s.role === 'hr'));
      }
    });
    this.quizService.getAdminQuizzes().subscribe({
      next: (res) => this.quizzes.set(res.quizzes || [])
    });
    this.newInterview = {
      candidateId: '', assignedInterviewers: [], assignedHRs: [], assignedPMs: [], position: '', techStack: '',
      source: '', dateOfInterview: new Date().toISOString().split('T')[0], timeOfInterview: '', quizIds: []
    };
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
  }

  toggleQuizSelection(quizId: string): void {
    const idx = this.newInterview.quizIds.indexOf(quizId);
    if (idx >= 0) {
      this.newInterview.quizIds.splice(idx, 1);
    } else {
      this.newInterview.quizIds.push(quizId);
    }
  }

  toggleSelection(event: any, array: string[]): void {
    const val = event.target.value;
    if (event.target.checked) {
      array.push(val);
    } else {
      const idx = array.indexOf(val);
      if (idx >= 0) array.splice(idx, 1);
    }
  }

  isQuizSelected(quizId: string): boolean {
    return this.newInterview.quizIds.includes(quizId);
  }

  createInterview(): void {
    if (!this.newInterview.candidateId || !this.newInterview.position) return;

    this.isSubmitting.set(true);
    this.quizService.createInterview(this.newInterview).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.closeCreateModal();
        this.loadInterviews();
        this.loadStats();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        alert(err.error?.message || 'Failed to create interview');
      }
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

  setDecision(decision: string): void {
    const interview = this.selectedInterview();
    if (!interview) return;

    this.quizService.setInterviewDecision(interview._id, decision).subscribe({
      next: (res) => {
        this.selectedInterview.set(res.interview);
        this.loadInterviews();
        this.loadStats();
      }
    });
  }

  deleteInterview(id: string): void {
    if (confirm('Are you sure you want to delete this interview?')) {
      this.quizService.deleteInterview(id).subscribe({
        next: () => {
          this.loadInterviews();
          this.loadStats();
          this.closeDetail();
        }
      });
    }
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
}
