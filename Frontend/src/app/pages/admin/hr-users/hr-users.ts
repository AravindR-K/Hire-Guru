import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { QuizService } from '../../../services/quiz.service';

@Component({
  selector: 'app-hr-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './hr-users.html',
  styleUrl: './hr-users.css'
})
export class AdminHrUsersComponent implements OnInit {
  hrUsers = signal<any[]>([]);
  loading = signal<boolean>(true);
  error = signal<string>('');
  success = signal<string>('');
  
  // Create New HR
  newName = signal('');
  newEmail = signal('');
  newPassword = signal('');
  creating = signal(false);

  // Edit HR
  editingId = signal<string | null>(null);
  editName = signal('');
  editEmail = signal('');
  editPassword = signal('');
  saving = signal(false);

  constructor(private quizService: QuizService) {}

  ngOnInit(): void {
    this.loadHRUsers();
  }

  loadHRUsers(): void {
    this.loading.set(true);
    this.quizService.getUsers('hr').subscribe({
      next: (res) => {
        this.hrUsers.set(res.users);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  createHRUser(): void {
    if (!this.newName().trim() || !this.newEmail().trim() || !this.newPassword().trim()) {
      this.error.set('Please fill out name, email, and password');
      return;
    }
    
    this.creating.set(true);
    this.error.set('');
    this.success.set('');

    this.quizService.createHRUser({
      name: this.newName().trim(),
      email: this.newEmail().trim(),
      password: this.newPassword().trim()
    }).subscribe({
      next: () => {
        this.success.set('HR User created successfully!');
        this.creating.set(false);
        this.newName.set('');
        this.newEmail.set('');
        this.newPassword.set('');
        this.loadHRUsers();
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Failed to create HR user');
        this.creating.set(false);
      }
    });
  }

  startEdit(user: any): void {
    this.editingId.set(user._id);
    this.editName.set(user.name);
    this.editEmail.set(user.email);
    this.editPassword.set(''); // Blank password to keep it unchanged if not specified
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  saveEdit(userId: string): void {
    const data: any = {};
    if (this.editName().trim()) data.name = this.editName().trim();
    if (this.editEmail().trim()) data.email = this.editEmail().trim();
    if (this.editPassword().trim()) data.password = this.editPassword().trim();

    this.saving.set(true);
    this.error.set('');
    this.success.set('');

    this.quizService.editUser(userId, data).subscribe({
      next: () => {
        this.success.set('HR User updated successfully!');
        this.saving.set(false);
        this.cancelEdit();
        this.loadHRUsers();
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Failed to update HR user');
        this.saving.set(false);
      }
    });
  }

  deleteHRUser(userId: string): void {
    if (confirm('Are you sure you want to delete this HR server? This revokes access entirely.')) {
      this.error.set('');
      this.success.set('');
      
      this.quizService.deleteUser(userId).subscribe({
        next: () => {
          this.success.set('HR User deleted successfully!');
          this.loadHRUsers();
        },
        error: (err) => {
          this.error.set(err.error?.message || 'Failed to delete HR user');
        }
      });
    }
  }
}
