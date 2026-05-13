import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QuizService } from '../../../services/quiz.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-interviewer-group-interview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './group-interview.html',
  styleUrl: './group-interview.css'
})
export class InterviewerGroupInterviewComponent implements OnInit {

  // -- List state --------------------------------------------
  interviews    = signal<any[]>([]);
  loading       = signal(true);
  filterStatus  = '';

  // -- Grouped view (one card per groupId) ------------------
  groupedList = computed<any[]>(() => {
    const map = new Map<string, any>();
    for (const iv of this.interviews()) {
      const key = iv.groupId || 'ungrouped';
      if (!map.has(key)) {
        map.set(key, {
          groupId: key,
          position: iv.position,
          techStack: iv.techStack,
          source: iv.source,
          dateOfInterview: iv.dateOfInterview,
          assignedInterviewers: iv.assignedInterviewers,
          assignedHRs: iv.assignedHRs,
          assignedPMs: iv.assignedPMs,
          members: []
        });
      }
      map.get(key)!.members.push(iv);
    }
    return Array.from(map.values());
  });

  stats = signal<any>({ total: 0, pending: 0, completed: 0, accepted: 0, rejected: 0 });

  // -- Group detail modal state -----------------------------
  showDetailModal   = signal(false);
  selectedGroup     = signal<any>(null);

  // -- Per-candidate (member) detail modal ------------------
  showMemberDetailModal    = signal(false);
  selectedMember           = signal<any>(null);
  memberEvalComment        = '';
  memberEvalRecommendation = '';
  isMemberSubmitting       = signal(false);
  isPdfGenerating          = signal(false);

  constructor(private quizService: QuizService, public authService: AuthService) {}

  ngOnInit(): void {
    this.loadInterviews();
    this.loadStats();
  }

  loadInterviews(): void {
    this.loading.set(true);
    const params: any = { type: 'group' };
    if (this.filterStatus) params.status = this.filterStatus;
    this.quizService.getInterviews(params).subscribe({
      next: res => { this.interviews.set(res.interviews || []); this.loading.set(false); },
      error: ()  => this.loading.set(false)
    });
  }

  loadStats(): void {
    this.quizService.getInterviewStats().subscribe({ next: res => this.stats.set(res) });
  }

  onFilterChange(): void { this.loadInterviews(); }

  // -- Group detail modal ------------------------------------
  openDetail(group: any): void {
    this.selectedGroup.set(group);
    this.showDetailModal.set(true);
  }

  closeDetail(): void {
    this.showDetailModal.set(false);
    this.selectedGroup.set(null);
  }

  // -- Member (candidate) detail modal ----------------------
  openMemberDetail(interviewId: string, event: Event): void {
    event.stopPropagation();
    this.quizService.getInterviewById(interviewId).subscribe({
      next: res => {
        this.selectedMember.set(res.interview);
        this.memberEvalComment = '';
        this.memberEvalRecommendation = '';
        this.showMemberDetailModal.set(true);
      }
    });
  }

  closeMemberDetail(): void {
    this.showMemberDetailModal.set(false);
    this.selectedMember.set(null);
  }

  submitMemberEvaluation(): void {
    const m = this.selectedMember();
    if (!m || !this.memberEvalRecommendation) return;
    this.isMemberSubmitting.set(true);
    this.quizService.submitEvaluation(m._id, {
      comments: this.memberEvalComment,
      recommendation: this.memberEvalRecommendation
    }).subscribe({
      next: res => {
        this.selectedMember.set(res.interview);
        this.memberEvalComment = '';
        this.memberEvalRecommendation = '';
        this.isMemberSubmitting.set(false);
        this.loadInterviews();
      },
      error: () => this.isMemberSubmitting.set(false)
    });
  }

  hasMemberEvaluated(): boolean {
    const m = this.selectedMember();
    if (!m) return false;
    const userId = this.authService.currentUser()?.id;
    return m.evaluations?.some((e: any) => e.evaluatorId?._id === userId || e.evaluatorId === userId);
  }

  allMemberEvaluationsDone(): boolean {
    const m = this.selectedMember();
    if (!m) return false;
    const total = (m.assignedInterviewers?.length || 0) +
                  (m.assignedHRs?.length || 0) +
                  (m.assignedPMs?.length || 0);
    if (total === 0) return false;
    return (m.evaluations?.length || 0) >= total;
  }

  needsEvaluation(m: any): boolean {
    if (m.status === 'completed') return false;
    const userId = this.authService.currentUser()?.id;
    const evaluated = m.evaluations?.some(
      (e: any) => e.evaluatorId?._id === userId || e.evaluatorId === userId
    );
    return !evaluated;
  }

  hasPendingEvaluations(m: any): boolean {
    if (m.status === 'completed') return false;
    const total = (m.assignedInterviewers?.length || 0) +
                  (m.assignedHRs?.length || 0) +
                  (m.assignedPMs?.length || 0);
    return (m.evaluations?.length || 0) < total;
  }

  downloadEvaluationPdf(): void {
    const m = this.selectedMember();
    if (!m) return;
    this.isPdfGenerating.set(true);
    setTimeout(() => {
      window.print();
      this.isPdfGenerating.set(false);
    }, 500);
  }

  // -- Helpers -----------------------------------------------
  getStatusClass(status: string): string {
    const map: any = {
      pending: 'badge-warning', quiz_phase: 'badge-info',
      coding_phase: 'badge-info', evaluation: 'badge-purple', completed: 'badge-success'
    };
    return map[status] || '';
  }

  getDecisionClass(decision: string): string {
    const map: any = {
      accepted: 'badge-success', rejected: 'badge-danger',
      on_hold: 'badge-warning', '2nd_round': 'badge-info'
    };
    return map[decision] || 'badge-muted';
  }

  formatStatus(status: string): string {
    return (status || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  formatDecision(d: string): string {
    const m: any = { pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected', on_hold: 'On Hold', '2nd_round': '2nd Round' };
    return m[d] || d;
  }

  groupStatusSummary(members: any[]): string {
    const counts: any = {};
    for (const m of members) counts[m.status] = (counts[m.status] || 0) + 1;
    return Object.entries(counts).map(([s, c]) => this.formatStatus(s) + ': ' + c).join(' · ');
  }

  pendingCount(members: any[]): number { return members.filter(m => m.status !== 'completed').length; }
  completedCount(members: any[]): number { return members.filter(m => m.status === 'completed').length; }

  // -- Quick-evaluate dropdown ---------------------------
  expandedGroups = new Set<string>();

  toggleExpand(groupId: string, event: Event): void {
    event.stopPropagation();
    if (this.expandedGroups.has(groupId)) {
      this.expandedGroups.delete(groupId);
    } else {
      this.expandedGroups.add(groupId);
    }
  }

  isExpanded(groupId: string): boolean {
    return this.expandedGroups.has(groupId);
  }

  groupHasPendingEvals(members: any[]): boolean {
    const userId = this.authService.currentUser()?.id;
    return members.some(m =>
      m.status !== 'completed' &&
      !m.evaluations?.some((e: any) => e.evaluatorId?._id === userId || e.evaluatorId === userId)
    );
  }

  getVisibleEvaluations(evaluations: any[]): any[] {
    if (!evaluations) return [];
    const userId = this.authService.currentUser()?.id;
    return evaluations.filter((e: any) => e.evaluatorId?._id === userId || e.evaluatorId === userId);
  }

}
