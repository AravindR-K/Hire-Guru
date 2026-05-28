import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { QuizService } from '../../../services/quiz.service';

@Component({
  selector: 'app-users',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './users.html',
  styleUrl: './users.css',
})
export class Users {
  users = signal<any[]>([]);
  loading = signal<boolean>(true);
  showAll = signal<boolean>(true);

  // Modal State
  showUserModal = signal<boolean>(false);
  isEditMode = signal<boolean>(false);
  savingUser = signal<boolean>(false);
  editingUserId = signal<string | null>(null);

  userForm = {
    name: '',
    email: '',
    password: ''
  };

  constructor(public authService: AuthService, private quizService: QuizService) {}

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

  getLevelLabel(level: string): string {
    const map: Record<string, string> = {
      beginner: 'Fresher',
      intermediate: 'Intern',
      advanced: 'Pre final year',
      expert: 'Final year'
    };
    return map[level?.toLowerCase()] || 'Fresher';
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

  openCreateModal(): void {
    this.isEditMode.set(false);
    this.editingUserId.set(null);
    this.userForm = { name: '', email: '', password: '' };
    this.showUserModal.set(true);
  }

  openEditModal(user: any): void {
    this.isEditMode.set(true);
    this.editingUserId.set(user._id);
    this.userForm = { name: user.name, email: user.email, password: '' };
    this.showUserModal.set(true);
  }

  closeModal(): void {
    this.showUserModal.set(false);
  }

  saveUser(): void {
    if (!this.userForm.name || !this.userForm.email) {
      alert('Name and email are required');
      return;
    }

    if (!this.isEditMode() && !this.userForm.password) {
      alert('Password is required when creating a new student');
      return;
    }

    this.savingUser.set(true);

    if (this.isEditMode() && this.editingUserId()) {
      // Edit User
      const payload: any = { name: this.userForm.name, email: this.userForm.email };
      if (this.userForm.password) {
        payload.password = this.userForm.password;
      }
      this.quizService.editUser(this.editingUserId()!, payload).subscribe({
        next: () => {
          this.savingUser.set(false);
          this.closeModal();
          this.loadUsers();
        },
        error: (err) => {
          console.error('Failed to update user', err);
          alert(err.error?.message || 'Failed to update user');
          this.savingUser.set(false);
        }
      });
    } else {
      // Create User
      this.authService.register(this.userForm.name, this.userForm.email, this.userForm.password).subscribe({
        next: () => {
          this.savingUser.set(false);
          this.closeModal();
          this.loadUsers();
        },
        error: (err) => {
          console.error('Failed to create user', err);
          alert(err.error?.message || 'Failed to create user');
          this.savingUser.set(false);
        }
      });
    }
  }

  logout(): void {
    this.authService.logout();
  }
}
