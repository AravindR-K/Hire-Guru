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

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please upload an image file (JPG, PNG, GIF, or WebP)');
      return;
    }

    // Validate file size (max 5MB before compression)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const img = new Image();
      img.onload = () => {
        // Resize to signature-appropriate dimensions and compress as JPEG
        const MAX_WIDTH = 600;
        const MAX_HEIGHT = 200;
        let width = img.width;
        let height = img.height;

        // Scale down proportionally if needed
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
        if (height > MAX_HEIGHT) {
          width = Math.round((width * MAX_HEIGHT) / height);
          height = MAX_HEIGHT;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        // White background so transparent PNGs look clean
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG at 80% quality (much smaller than raw PNG base64)
        const base64String = canvas.toDataURL('image/jpeg', 0.8);

        this.isUploadingSignature.set(true);
        this.authService.uploadSignature({ signature: base64String }).subscribe({
          next: (res) => {
            this.isUploadingSignature.set(false);
            if (res.signature) {
              this.user.update(u => ({ ...u, signature: res.signature }));
            }
          },
          error: (err) => {
            this.isUploadingSignature.set(false);
            alert(err.error?.message || 'Error uploading signature. Please try again.');
          }
        });
      };
      img.onerror = () => {
        alert('Failed to load image. Please try a different file.');
      };
      img.src = e.target.result;
    };
    reader.onerror = () => {
      alert('Failed to read file. Please try again.');
    };
    reader.readAsDataURL(file);
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
    // Since signature is a base64 data URI, we just return it directly
    return signature;
  }
}
