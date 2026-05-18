import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { QuizService } from '../../../services/quiz.service';

@Component({
  selector: 'app-interviewer-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit {
  stats = signal<any>({ total: 0, pending: 0, completed: 0 });
  recentSubmissions = signal<any[]>([]);
  loading = signal(true);

  constructor(private quizService: QuizService) {}

  ngOnInit(): void {
    this.quizService.getInterviewStats().subscribe({
      next: (res) => {
        this.stats.set(res);
        this.recentSubmissions.set(res.recentSubmissions || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }
}
