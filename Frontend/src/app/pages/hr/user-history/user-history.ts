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

  hasEvaluations(interview: any): boolean {
    return (interview.evaluations?.length || 0) > 0;
  }

  downloadEvaluationForm(interview: any): void {
    const u = this.user();
    const candidateName = u?.name || '';
    const dateStr = interview.dateOfInterview
      ? new Date(interview.dateOfInterview).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : '';
    const position = interview.position || '';
    const source = interview.source || '';
    const techStack = interview.techStack || '';

    const interviewerNames = (interview.assignedInterviewers || [])
      .map((i: any) => i.name || '').filter(Boolean).join(', ')
      || interview.interviewerId?.name || 'Unassigned';

    const quizzes = interview.quizzes || [];
    const q1 = quizzes[0];
    const q2 = quizzes[1];
    const q1Name = q1?.quizId?.title || q1?.title || '';
    const q1Score = (q1?.score != null) ? `${q1.score}/${q1.totalMarks}` : '';
    const q2Name = q2?.quizId?.title || q2?.title || '';
    const q2Score = (q2?.score != null) ? `${q2.score}/${q2.totalMarks}` : '';

    const evals = interview.evaluations || [];
    const ivEval = evals.find((e: any) => e.evaluatorRole === 'interviewer');
    const pmEval = evals.find((e: any) => e.evaluatorRole === 'pm');
    const hrEval = evals.find((e: any) => e.evaluatorRole === 'hr');
    const adminEval = evals.find((e: any) => e.evaluatorRole === 'admin');

    const recMap: Record<string, string> = {
      offer: 'Offer/Hire as Intern', on_hold: 'On Hold',
      rejected: 'Rejected', '2nd_round': '2nd Round'
    };

    const buildCheckboxes = (groupName: string, rec: string): string =>
      ['offer', 'on_hold', 'rejected', '2nd_round'].map(val => {
        const checked = rec === val ? 'checked' : '';
        const label = val === '2nd_round' ? '2<sup>nd</sup> Round' : recMap[val];
        return `<label style="display:flex;align-items:center;gap:5px;font-size:13px;"><input type="checkbox" name="${groupName}" ${checked} style="width:14px;height:14px;accent-color:#4472C4;"> ${label}</label>`;
      }).join('');

    const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString('en-GB') : '';
    const ivName = ivEval?.evaluatorId?.name || 'Interviewer';
    const pmName = pmEval?.evaluatorId?.name || 'Project Manager';
    const hrName = hrEval?.evaluatorId?.name || 'HR';
    const overallRec = adminEval?.recommendation || interview.finalDecision || '';

    const ITL_LOGO = 'data:image/gif;base64,R0lGODlhtgBCAPcAAPqsTtTimLXVfMHah/y6Yf7QfP/snt7oov/ikf/ejb/f8b/a6r/Y6L/W5vqvUtrmnvu2XP7Ebf/UgPqwVPu4XsXciv7Jc9jv+r/q+Mzfkefsq7/n9+HppfigP//SftDhlc7gk+jy2vqyV8rejvidO9jknPuzWarQcvmpSviiQv3ky/3lzLTUev3jyfeZNveXM//XhP7Mdv7KdP7Gb7nZjr3Yg7jWf6rPcfH24v/nmePqp9Pil8Pbif7Hcf3BabvXgbPUeaXObPaTL3+83b/e7kCbzQCFzNXV1oKCg6urrODg4Orq6t/u9/X19e/3+2JiZJ/N5iCLxIrN8ZTR8nd3eQCDyp7V9BCCwKja9svLy21tb7Hd98/m8rnh+MDAwcHl+X/C5a/V6jCTyXC02ZeXmGCs1Y/F4le86wCg4AB3uuDy+0W46QCAxgB/wQCd3wCk4X/I8ABztgB6vwBnqABjpABvsQGr5ABcnQCn4xOv5nLE7i206AB9wgBfoGXA7ABqrKGhokCh1gCCyFhYWra2t1Ck0c/o9fmoSRCNz0Ck2f29ZPqtUP7NePu1W/3o0IyMjvmrTf7Cav3AZ/3p0f/bifmnSP2+ZfmqTL/c7fL3477ZhM3gkv3nz7/d7rDTd6/Sdv7q07/o99Xu+r/e77/f78Tr+f7Da/3mzfqxVvmlRfquUdLhlvmmR8jdjf7Pesrs+dzw+/u0WdDt+fihQLzakq3RdPikRPmkRf/Wg/3nzvy7Yv748cLk+LTXirbYjMjn+feaN+vur/mlRt/v+Pu5YPy8Y+vvsP/ml3C54Mnejv2/Zp/R7Mfn+Ofy2fu3XvPzuP/ciurz3LLTeO/14KDMZ9Xr5v3p0v3q0vqwU/u2W/7Qe8/glNzmn7zi96LNav7Bae314P/YhqjPb8Tbif7Fbcjeje3wsf7Oec7p+vmqSzCa0hCKyxCLzfD24bXf9tPs+/ibOdXjmfiePP3o0fDxtPaQK0Ci1+Xrqv7Icf/ZiOz03e303qfObrrakAB6vP///yH/C1hNUCBEYXRhWE1QPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS4wLWMwNjEgNjQuMTQwOTQ5LCAyMDEwLzEyLzA3LTEwOjU3OjAxICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIiB4bXBNTTpPcmlnaW5hbERvY3VtZW50SUQ9InV1aWQ6M0VFQTQ2RTUwQjUxRTIxMTg3NjBBREQ5OUJDNDQyNkYiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6RkQzNEU5MjI5NDI2MTFFMzlFMzJCNTI0NkY5NTYwMUYiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6RkQzNEU5MjE5NDI2MTFFMzlFMzJCNTI0NkY5NTYwMUYiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgSWxsdXN0cmF0b3IgQ1M1Ij4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6ODYxQjI3MzY3Mjc2RTMxMUEzQjZERTY4M0Y2RDE5QTEiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6ODYxQjI3MzY3Mjc2RTMxMUEzQjZERTY4M0Y2RDE5QTEiLz4gPGRjOnRpdGxlPiA8cmRmOkFsdD4gPHJkZjpsaSB4bWw6bGFuZz0ieC1kZWZhdWx0Ij5JVExfQkNfQVc8L3JkZjpsaT4gPC9yZGY6QWx0PiA8L2RjOnRpdGxlPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PgH//v38+/r5+Pf29fTz8vHw7+7t7Ovq6ejn5uXk4+Lh4N/e3dzb2tnY19bV1NPS0dDPzs3My8rJyMfGxcTDwsHAv769vLu6ubi3trW0s7KxsK+urayrqqmop6alpKOioaCfnp2cm5qZmJeWlZSTkpGQj46NjIuKiYiHhoWEg4KBgH9+fXx7enl4d3Z1dHNycXBvbm1sa2ppaGdmZWRjYmFgX15dXFtaWVhXVlVUU1JRUE9OTUxLSklIR0ZFRENCQUA/Pj08Ozo5ODc2NTQzMjEwLy4tLCsqKSgnJiUkIyIhIB8eHRwbGhkYFxYVFBMSERAPDg0MCwoJCAcGBQQDAgEAACH5BAAAAAAALAAAAAC2AEIAAAj/AP8JHEiwoMGDCBMqXMiwocOHECNKnEixosWLGDNq3Mixo8ePIEMO3NWihYoVK06dysXJkct5k0TKnEkzY4t6Ql64gCevQwpbwiodGlqzqNGjCVXkBEbCZ6pKKC5BArBoEdKrWGuqeMF0li1WKCAtcjABlQgRWdOq7bgCmLxZtw5dWoRNhIlGEJxRWMu3L8VTJGalOgRJFapYEIgRKKZIkd/HkBfm6hAXgAMRjSjosiTJRyRTkUOLFsgpRSVIlyEQUOTDFLkZ+PCNnv3YEat0qkSothSJXA8ZMRgxot187aRDi1A1IsB7hoUYrgp48ICxiPUxBK1r314kTJiDULiL/9eOHTz5hOGtcynOcNIlByYoKPo2QwajAhIk4IKB0Z//IgT5J+CAAkZBREFDEKiggAAeJMaATCCUoH8HsqeQNQCgko0ukkRgwX0SwJAPJdD091+ACyoIBUETpjhggwUxQaAZEgpYoYUIXaOKCc4oEkkPMWgTIiUJIICAif7A+M+L2ykYoUAtRjHeeQaZQaAYNVKIY0KgOBALMcp4eI4HuBCJwDE5IKnkgAU5McaAZQzU4hASPUjgkwjauCVCoEywnCTkyOCKBOEUmYMBBqiJon8HteiPnALSCREXApYhII0GtXjjnlcxuOijBjkx4Hr/zBnRm/5xcYV/UTSqJ6dYef86EJsHFfGqqRBFweo/lqaa6auwIiWrQLQaZKuWpUY6qYDYhcHsr8iO9sW01FZr7bVfXGDQM/QYowEH3MTzwQjjaGKDNCfQktCwSwqI0LH+VNhiEUPUa6+9B6Ea7z+i7ppntKJ1IfDABBdssMDvFGROMBrocMADO4DQCg81COBJuuueOKu7td7qYrEErerPFQMVAiyUJ4e2xcust+zyyyyjQ5AG9zj8gLgZVDDADwJ8ckM/GSf56bsef8xoQc76F6dAUFT6776zYSH11FRXbTXVvwzEAQcPx7PKJuXwYC4QtfADNELsgpxd0UYb1Ks/3wnU78hPbxqaFXjnrffefO//zYtA3DxQgtcgjKAzzxcHQUPQa3JsLNuSNiSyP06s7V/cKAMc2hScd+7556CD3s0/8QSwwwebJKNzDTaQLY43vjA+dMfI4spQ0/5dwZ2uSrOYcmRSBC/88MQXb7w722yTwQitrG4DCz4HQU0vsm98tEG8Q237QiYbPXLlmUM9mhrkl2//...AAAAAAAAA7';

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<title>ITL Evaluation - ${candidateName}</title><style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{font-family:Arial,sans-serif;background:#fff;color:#000;padding:24px;font-size:13px;}
.page-wrap{max-width:780px;margin:0 auto;border:1px solid #ccc;}
.header{background:#4472C4;display:flex;align-items:center;justify-content:space-between;padding:10px 16px;}
.header h1{color:#fff;font-size:16px;font-weight:bold;font-style:italic;text-decoration:underline;}
.logo-wrap img{height:52px;object-fit:contain;}
.info-table{width:100%;border-collapse:collapse;}
.info-table td{border:1px solid #bbb;padding:6px 10px;vertical-align:middle;}
.info-table .label{font-weight:bold;background:#fff;width:160px;white-space:nowrap;}
.info-table .value{background:#fff;color:#444;font-style:italic;}
.comments-section{border:1px solid #bbb;border-top:none;padding:10px 16px;}
.comments-label{font-weight:bold;margin-bottom:6px;}
.comments-text{min-height:65px;font-size:13px;font-family:Arial,sans-serif;color:#333;line-height:1.5;padding:4px 0;}
.rec-row{border:1px solid #bbb;border-top:none;padding:8px 16px;display:flex;align-items:center;gap:20px;flex-wrap:wrap;}
.rec-label{font-weight:bold;white-space:nowrap;}
.sig-row{border:1px solid #bbb;border-top:none;padding:8px 16px;display:flex;align-items:flex-end;gap:40px;}
.sig-field{display:flex;align-items:flex-end;gap:8px;}
.sig-field label{font-weight:bold;white-space:nowrap;}
.sig-line{border-bottom:1px solid #000;min-width:200px;height:18px;font-style:italic;color:#555;font-size:13px;}
.sig-line-date{min-width:140px;}
.actions{margin-top:16px;display:flex;justify-content:flex-end;gap:10px;}
.btn{font-size:13px;font-family:Arial,sans-serif;padding:7px 18px;border-radius:3px;cursor:pointer;border:1px solid #aaa;}
.btn-print{background:#4472C4;color:#fff;border-color:#3360b0;}
@media print{body{padding:0;}.actions{display:none;}}
</style></head><body>
<div class="page-wrap">
  <div class="header">
    <h1>Intern Interview Evaluation Form</h1>
    <div class="logo-wrap"><img src="${ITL_LOGO}" alt="ITL Logo"/></div>
  </div>
  <table class="info-table"><tbody>
    <tr>
      <td class="label">Candidate Name:</td><td class="value">${candidateName}</td>
      <td class="label">Date of Interview:</td><td class="value">${dateStr}</td>
    </tr>
    <tr>
      <td class="label">Position:</td><td class="value">${position}</td>
      <td class="label">Source:</td><td class="value">${source}</td>
    </tr>
    <tr>
      <td class="label">Tech Stack:</td><td class="value">${techStack}</td>
      <td class="label"><strong>Interviewer:</strong></td><td class="value">${interviewerNames}</td>
    </tr>
    <tr>
      <td class="label">General Aptitude Test QP Set</td><td class="value">${q1Name}</td>
      <td class="label"><strong>General Aptitude Test Score</strong></td><td class="value">${q1Score}</td>
    </tr>
    <tr>
      <td class="label">Technical MCQ Test QP Set</td><td class="value">${q2Name}</td>
      <td class="label"><strong>Technical MCQ Test Score</strong></td><td class="value">${q2Score}</td>
    </tr>
  </tbody></table>
  <div class="comments-section" style="margin-top:0;">
    <div class="comments-label">Interviewer's Comments (${ivName}):</div>
    <div class="comments-text">${ivEval?.comments || ''}</div>
  </div>
  <div class="rec-row"><span class="rec-label">Recommendation:</span>${buildCheckboxes('rec1', ivEval?.recommendation || '')}</div>
  <div class="sig-row">
    <div class="sig-field"><label>Evaluator's Signature:</label><div class="sig-line">${ivName}</div></div>
    <div class="sig-field"><label>Date:</label><div class="sig-line sig-line-date">${fmtDate(ivEval?.date)}</div></div>
  </div>
  <div class="comments-section">
    <div class="comments-label">Project Manager Comments (${pmName}):</div>
    <div class="comments-text">${pmEval?.comments || ''}</div>
  </div>
  <div class="rec-row"><span class="rec-label">Recommendation:</span>${buildCheckboxes('rec2', pmEval?.recommendation || '')}</div>
  <div class="sig-row">
    <div class="sig-field"><label>Evaluator's Signature:</label><div class="sig-line">${pmName}</div></div>
    <div class="sig-field"><label>Date:</label><div class="sig-line sig-line-date">${fmtDate(pmEval?.date)}</div></div>
  </div>
  <div class="comments-section">
    <div class="comments-label">HR Comments (${hrName}):</div>
    <div class="comments-text" style="min-height:52px;">${hrEval?.comments || ''}</div>
  </div>
  <div class="rec-row"><span class="rec-label">Recommendation:</span>${buildCheckboxes('rec3', hrEval?.recommendation || '')}</div>
  <div class="sig-row">
    <div class="sig-field"><label>Evaluator's Signature:</label><div class="sig-line">${hrName}</div></div>
    <div class="sig-field"><label>Date:</label><div class="sig-line sig-line-date">${fmtDate(hrEval?.date)}</div></div>
  </div>
  <div class="comments-section"><div class="comments-label">Overall Recommendation:</div></div>
  <div class="rec-row"><span class="rec-label">Recommendation:</span>${buildCheckboxes('rec-overall', overallRec)}</div>
  <div class="sig-row">
    <div class="sig-field"><label>Authorized Signature:</label><div class="sig-line">${adminEval?.evaluatorId?.name || ''}</div></div>
    <div class="sig-field"><label>Date:</label><div class="sig-line sig-line-date">${fmtDate(adminEval?.date)}</div></div>
  </div>
</div>
<div class="actions">
  <button class="btn btn-print" onclick="window.print()">&#128438; Print / Save as PDF</button>
</div>
</body></html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
    }
  }
}
