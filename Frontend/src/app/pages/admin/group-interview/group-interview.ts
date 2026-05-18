import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QuizService } from '../../../services/quiz.service';
import { AuthService } from '../../../services/auth.service';

export interface QuizEntry {
  quizId: string;
}

export interface QuizSet {
  quizEntries: QuizEntry[];
  mode: 'random' | 'direct';
  directAssignments: { [candidateId: string]: string };
}

@Component({
  selector: 'app-group-interview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './group-interview.html',
  styleUrl: './group-interview.css'
})
export class GroupInterviewComponent implements OnInit {

  // ── List state ────────────────────────────────────────────
  interviews = signal<any[]>([]);
  loading = signal(true);
  filterStatus = '';

  // ── Grouped view (one card per groupId) ──────────────────
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

  // ── Create modal state ────────────────────────────────────
  showCreateModal = signal(false);
  isSubmitting = signal(false);
  successMsg = signal('');

  // dropdown data
  groups = signal<any[]>([]);
  interviewers = signal<any[]>([]);
  hrs = signal<any[]>([]);
  pms = signal<any[]>([]);
  quizzes = signal<any[]>([]);
  groupMembers = signal<any[]>([]);

  // form
  newGroupInterview = this.blankForm();

  // quiz-set builder
  showQuizSetup = false;
  pendingSetsCount = 2;
  quizSets: QuizSet[] = [];

  // ── Group detail modal state ─────────────────────────────
  showDetailModal = signal(false);
  selectedGroup = signal<any>(null);

  // ── Per-candidate (member) detail modal ──────────────────
  showMemberDetailModal = signal(false);
  selectedMember = signal<any>(null);   // full interview doc
  memberEvalComment = '';
  memberEvalRecommendation = '';
  isMemberSubmitting = signal(false);

  constructor(private quizService: QuizService, public authService: AuthService) { }

  ngOnInit(): void {
    this.loadInterviews();
    this.loadStats();
  }

  // ── Data loaders ──────────────────────────────────────────
  loadInterviews(): void {
    this.loading.set(true);
    const params: any = { type: 'group' };
    if (this.filterStatus) params.status = this.filterStatus;
    this.quizService.getInterviews(params).subscribe({
      next: res => { this.interviews.set(res.interviews || []); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  loadStats(): void {
    this.quizService.getInterviewStats().subscribe({ next: res => this.stats.set(res) });
  }

  onFilterChange(): void { this.loadInterviews(); }

  // ── Create modal ──────────────────────────────────────────
  openCreateModal(): void {
    this.newGroupInterview = this.blankForm();
    this.quizSets = [];
    this.showQuizSetup = false;
    this.pendingSetsCount = 2;
    this.groupMembers.set([]);
    this.successMsg.set('');

    this.quizService.getGroups().subscribe({ next: r => this.groups.set(r.groups || []) });
    this.quizService.getInterviewers().subscribe({
      next: r => {
        const staff = r.interviewers || [];
        this.interviewers.set(staff.filter((s: any) => s.role === 'interviewer'));
        this.pms.set(staff.filter((s: any) => s.role === 'pm'));
        this.hrs.set(staff.filter((s: any) => s.role === 'hr'));
      }
    });
    this.quizService.getQuizzes().subscribe({ next: r => this.quizzes.set(r.quizzes || []) });
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
    this.successMsg.set('');
  }

  blankForm() {
    return {
      groupName: '',
      assignedInterviewers: [] as string[],
      assignedHRs: [] as string[],
      assignedPMs: [] as string[],
      position: '',
      techStack: '',
      source: '',
      dateOfInterview: new Date().toISOString().split('T')[0]
    };
  }

  toggleSelection(event: any, array: string[]): void {
    const val = event.target.value;
    if (event.target.checked) { array.push(val); }
    else { const i = array.indexOf(val); if (i >= 0) array.splice(i, 1); }
  }

  onGroupChange(): void {
    if (!this.newGroupInterview.groupName) { this.groupMembers.set([]); return; }
    this.quizService.getGroupMembers(this.newGroupInterview.groupName).subscribe({
      next: r => {
        this.groupMembers.set(r.candidates || []);
        // reset direct assignments when group changes
        for (const set of this.quizSets) set.directAssignments = {};
      }
    });
  }

  // ── Quiz Sets builder ─────────────────────────────────────
  confirmSetsCount(): void {
    const n = Math.max(1, Math.min(10, this.pendingSetsCount || 1));
    this.quizSets = Array.from({ length: n }, (_, i) => ({
      quizEntries: [],
      mode: 'random',
      directAssignments: {}
    }));
    this.showQuizSetup = false;
  }

  addQuizToSet(setIdx: number): void {
    this.quizSets[setIdx].quizEntries.push({ quizId: '' });
  }

  removeQuizEntry(setIdx: number, entryIdx: number): void {
    this.quizSets[setIdx].quizEntries.splice(entryIdx, 1);
  }

  removeQuizSet(setIdx: number): void {
    this.quizSets.splice(setIdx, 1);
  }

  addMoreSet(): void {
    this.quizSets.push({ quizEntries: [], mode: 'random', directAssignments: {} });
  }

  /** Quizzes available for a specific dropdown (setIdx, entryIdx).
   *  Excludes any quizId already chosen in ANY other (set, entry) pair. */
  getAvailableQuizzes(setIdx: number, entryIdx: number): any[] {
    const usedIds = new Set<string>();
    this.quizSets.forEach((set, si) => {
      set.quizEntries.forEach((entry, ei) => {
        if (entry.quizId && !(si === setIdx && ei === entryIdx)) usedIds.add(entry.quizId);
      });
    });
    return this.quizzes().filter(q => !usedIds.has(q._id));
  }

  getQuizTitle(quizId: string): string {
    return this.quizzes().find(q => q._id === quizId)?.title || quizId;
  }

  validEntries(set: QuizSet): QuizEntry[] {
    return set.quizEntries.filter(e => e.quizId);
  }

  isSingleQuizSet(set: QuizSet): boolean {
    return this.validEntries(set).length === 1;
  }

  isMultiQuizSet(set: QuizSet): boolean {
    return this.validEntries(set).length > 1;
  }

  // ── Create interview ──────────────────────────────────────
  createGroupInterview(): void {
    if (!this.newGroupInterview.groupName || !this.newGroupInterview.position) return;
    this.isSubmitting.set(true);

    const payload = {
      ...this.newGroupInterview,
      quizSets: this.quizSets.map(set => ({
        quizEntries: set.quizEntries.filter(e => e.quizId),
        mode: set.mode,
        directAssignments: set.directAssignments
      }))
    };

    this.quizService.createGroupInterview(payload).subscribe({
      next: res => {
        this.isSubmitting.set(false);
        this.successMsg.set(res.message || `Interview created for ${res.count} candidates!`);
        this.loadInterviews();
        this.loadStats();
      },
      error: err => {
        this.isSubmitting.set(false);
        alert(err.error?.message || 'Failed to create group interview');
      }
    });
  }

  // ── Group detail modal ────────────────────────────────────
  openDetail(group: any): void {
    this.selectedGroup.set(group);
    this.showDetailModal.set(true);
  }

  closeDetail(): void {
    this.showDetailModal.set(false);
    this.selectedGroup.set(null);
  }

  // ── Member (candidate) detail modal ──────────────────────
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
        // refresh the group list so chips update
        this.loadInterviews();
      },
      error: () => this.isMemberSubmitting.set(false)
    });
  }

  setMemberDecision(decision: string): void {
    const m = this.selectedMember();
    if (!m) return;
    this.quizService.setInterviewDecision(m._id, decision).subscribe({
      next: res => {
        this.selectedMember.set(res.interview);
        this.loadInterviews();
        this.loadStats();
      }
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

  /** True when THIS user still needs to evaluate this member */
  needsEvaluation(m: any): boolean {
    if (m.status === 'completed' || (m.finalDecision && m.finalDecision !== 'pending')) return false;
    const userId = this.authService.currentUser()?.id;
    const evaluated = m.evaluations?.some(
      (e: any) => e.evaluatorId?._id === userId || e.evaluatorId === userId
    );
    return !evaluated;
  }

  /** Whether ANY assigned staff member hasn't evaluated a given candidate interview yet */
  hasPendingEvaluations(m: any): boolean {
    if (m.status === 'completed') return false;
    const total = (m.assignedInterviewers?.length || 0) +
      (m.assignedHRs?.length || 0) +
      (m.assignedPMs?.length || 0);
    return (m.evaluations?.length || 0) < total;
  }

  isPdfGenerating = signal(false);

  downloadEvaluationPdf(): void {
    const m = this.selectedMember();
    if (!m) return;

    this.isPdfGenerating.set(true);

    setTimeout(() => {
      window.print();
      this.isPdfGenerating.set(false);
    }, 500);
  }

  // ── Helpers ───────────────────────────────────────────────
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
    return Object.entries(counts).map(([s, c]) => `${this.formatStatus(s)}: ${c}`).join(' · ');
  }

  pendingCount(members: any[]): number { return members.filter(m => m.status !== 'completed').length; }
  completedCount(members: any[]): number { return members.filter(m => m.status === 'completed').length; }

  deleteGroupInterview(groupId: string): void {
    if (!confirm(`Delete all interviews in group "${groupId}"?`)) return;
    const ids = (this.groupedList().find(g => g.groupId === groupId)?.members || []).map((m: any) => m._id);
    let done = 0;
    for (const id of ids) {
      this.quizService.deleteInterview(id).subscribe({ next: () => { done++; if (done === ids.length) { this.loadInterviews(); this.closeDetail(); } } });
    }
  }

  setDecision(interviewId: string, decision: string): void {
    this.quizService.setInterviewDecision(interviewId, decision).subscribe({
      next: () => this.loadInterviews()
    });
  }

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

}
