import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { QuizService } from '../../../services/quiz.service';
import { UiService } from '../../../services/ui.service';

@Component({
  selector: 'app-hr-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class HRDashboardComponent implements OnInit {
  stats = signal<any>(null);
  recentSubmissions = signal<any[]>([]);
  loading = signal(true);

  constructor(private quizService: QuizService, private uiService: UiService) {}

  ngOnInit(): void {
    this.quizService.getHRStats().subscribe({
      next: (res) => {
        this.stats.set(res.stats);
        this.recentSubmissions.set(res.recentSubmissions || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  openUsersPopup(): void {
    this.uiService.showManageUsersPopup.set(true);
  }

  openInterviewPopup(): void {
    this.uiService.showInterviewPopup.set(true);
  }
}
