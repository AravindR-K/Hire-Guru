import { Component, OnInit, signal } from '@angular/core';
import { Location } from '@angular/common';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
  
  // Create New Staff
  newName = signal('');
  newEmail = signal('');
  newPassword = signal('');
  currentRole = signal('hr');
  creating = signal(false);

  // Edit HR
  editingId = signal<string | null>(null);
  editName = signal('');
  editEmail = signal('');
  editPassword = signal('');
  saving = signal(false);

  constructor(private quizService: QuizService, private route: ActivatedRoute, private location: Location) {}

  goBack(): void {
    this.location.back();
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const role = params.get('role');
      if (role) {
        this.currentRole.set(role);
      }
      this.loadHRUsers();
    });
  }

  loadHRUsers(): void {
    this.loading.set(true);
    this.quizService.getUsers().subscribe({
      next: (res) => {
        // Filter users based on current role
        const staff = res.users.filter((u: any) => u.role === this.currentRole());
        this.hrUsers.set(staff);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  createHRUser(): void {
    if (!this.newName().trim() || !this.newEmail().trim() || !this.newPassword().trim()) {
      this.error.set('Please fill out all fields');
      return;
    }
    
    this.creating.set(true);
    this.error.set('');
    this.success.set('');

    this.quizService.createStaffUser({
      name: this.newName().trim(),
      email: this.newEmail().trim(),
      password: this.newPassword().trim(),
      role: this.currentRole()
    }).subscribe({
      next: () => {
        this.success.set('Staff User created successfully!');
        this.creating.set(false);
        this.newName.set('');
        this.newEmail.set('');
        this.newPassword.set('');
        this.loadHRUsers();
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Failed to create staff user');
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
        this.success.set('Staff User updated successfully!');
        this.saving.set(false);
        this.cancelEdit();
        this.loadHRUsers();
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Failed to update staff user');
        this.saving.set(false);
      }
    });
  }

  deleteHRUser(userId: string): void {
    if (confirm('Are you sure you want to delete this staff user? This revokes access entirely.')) {
      this.error.set('');
      this.success.set('');
      
      this.quizService.deleteUser(userId).subscribe({
        next: () => {
          this.success.set('Staff User deleted successfully!');
          this.loadHRUsers();
        },
        error: (err) => {
          this.error.set(err.error?.message || 'Failed to delete staff user');
        }
      });
    }
  }
  getRoleDisplay(): string {
    const role = this.currentRole();
    if (role === 'hr') return 'HR User';
    if (role === 'pm') return 'Project Manager';
    if (role === 'interviewer') return 'Interviewer';
    return 'Staff User';
  }
}
