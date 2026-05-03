import { Component, OnInit, signal } from '@angular/core';
import { Location } from '@angular/common';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { QuizService } from '../../../services/quiz.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './users.html',
  styleUrl: './users.css'
})
export class AdminUsersComponent implements OnInit {
  users = signal<any[]>([]);
  loading = signal<boolean>(true);
  showAll = signal<boolean>(true);

  constructor(public authService: AuthService, private quizService: QuizService, private location: Location) {}

  goBack(): void {
    this.location.back();
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    const request = this.showAll() ? this.quizService.getUsers('candidate') : this.quizService.getLoggedInUsers();
    request.subscribe({
      next: (res) => {
        const filtered = res.users.filter((u: any) => u.role === 'candidate');
        this.users.set(filtered);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  toggleFilter(showAll: boolean): void {
    this.showAll.set(showAll);
    this.loadUsers();
  }

  deleteUser(userId: string): void {
    if (confirm('Are you sure you want to permanently delete this student user?')) {
      this.quizService.deleteUser(userId).subscribe({
        next: () => {
          this.loadUsers();
        },
        error: (err) => {
          console.error('Failed to delete user', err);
          alert('Failed to delete student user.');
        }
      });
    }
  }

  logout(): void {
    this.authService.logout();
  }
}
