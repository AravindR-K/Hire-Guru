import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-staff-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class StaffProfileComponent implements OnInit {
  user = signal<any>(null);
  loading = signal(true);
  
  // Edit Profile State
  isEditingProfile = signal(false);
  isSavingProfile = signal(false);
  editName = signal('');
  editEmail = signal('');
  editPhone = signal('');
  
  isUploadingSignature = signal(false);

  constructor(public authService: AuthService) {}

  ngOnInit(): void {
    this.authService.getMe().subscribe({
      next: (res) => {
        this.user.set(res.user);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  openEditProfile() {
    const currentUser = this.user();
    if (currentUser) {
      this.editName.set(currentUser.name || '');
      this.editEmail.set(currentUser.email || '');
      this.editPhone.set(currentUser.phoneNumber || '');
      this.isEditingProfile.set(true);
    }
  }

  closeEditProfile() {
    this.isEditingProfile.set(false);
  }

  saveProfile() {
    if (!this.editName().trim() || !this.editEmail().trim()) {
      alert("Name and Email are required");
      return;
    }

    this.isSavingProfile.set(true);
    
    const formData = new FormData();
    formData.append('name', this.editName());
    formData.append('email', this.editEmail());
    formData.append('phoneNumber', this.editPhone());

    this.authService.updateProfile(formData).subscribe({
      next: (res) => {
        this.user.set(res.user);
        // Also update authService currentUser partially
        const current = this.authService.currentUser();
        if (current) {
           this.authService.currentUser.set({...current, name: res.user.name, email: res.user.email});
        }
        this.isSavingProfile.set(false);
        this.closeEditProfile();
      },
      error: (err) => {
        console.error(err);
        alert('Failed to update profile');
        this.isSavingProfile.set(false);
      }
    });
  }

  uploadSignature(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    this.isUploadingSignature.set(true);
    const formData = new FormData();
    formData.append('signature', file);

    this.authService.uploadSignature(formData).subscribe({
      next: (res) => {
        this.isUploadingSignature.set(false);
        if (res.signature) {
          // Update user signal
          this.user.update(u => ({ ...u, signature: res.signature }));
        }
      },
      error: (err) => {
        this.isUploadingSignature.set(false);
        alert(err.error?.message || 'Error uploading signature');
      }
    });
  }

  deleteSignature(): void {
    if (!confirm('Are you sure you want to delete your signature?')) return;
    
    // We could make a DELETE endpoint, but for now we just upload an empty file or assume there is an endpoint.
    // Actually, backend auth.js has no delete signature endpoint. Let's just alert that it's not supported yet
    // or we can just not provide delete for now, or add an endpoint.
    alert('Deleting signature is not implemented yet. Please upload a new one to replace it.');
  }

  getSignatureUrl(): string {
    const signature = this.user()?.signature;
    if (!signature) return '';
    return `http://localhost:5000${signature}`;
  }
}
