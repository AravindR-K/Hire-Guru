import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { QuizService } from '../../../services/quiz.service';

interface TopicOfInterest {
  topic: string;
  comfortLevel: number;
}

@Component({
  selector: 'app-candidate-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class CandidateProfileComponent implements OnInit {
  user = signal<any>(null);
  submissions = signal<any[]>([]);
  loading = signal(true);
  
  topics = signal<TopicOfInterest[]>([]);
  
  // State for new topic form
  newTopicName = signal('');
  newTopicComfort = signal(50);
  isSavingTopics = signal(false);

  // Edit Profile State
  isEditingProfile = signal(false);
  isSavingProfile = signal(false);
  editName = signal('');
  editEmail = signal('');
  editPhone = signal('');
  selectedResume = signal<File | null>(null);

  constructor(public authService: AuthService, private quizService: QuizService) {}

  ngOnInit(): void {
    this.quizService.getCandidateProfile().subscribe({
      next: (res) => {
        this.user.set(res.user);
        this.topics.set(res.user.topicsOfInterest || []);
        this.submissions.set(res.submissions || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  get testsTaken(): number { return this.submissions().length; }
  get avgScore(): number {
    const subs = this.submissions();
    if (subs.length === 0) return 0;
    return Math.round(subs.reduce((a, s) => a + s.percentage, 0) / subs.length);
  }
  get bestScore(): number {
    const subs = this.submissions();
    if (subs.length === 0) return 0;
    return Math.max(...subs.map(s => s.percentage));
  }

  // --- Topic Management ---

  addTopic() {
    const topic = this.newTopicName().trim();
    if (!topic) return;

    const newTopicList = [...this.topics(), { topic, comfortLevel: this.newTopicComfort() }];
    this.topics.set(newTopicList);
    
    // Clear form
    this.newTopicName.set('');
    this.newTopicComfort.set(50);
    
    this.saveTopics(newTopicList);
  }

  removeTopic(index: number) {
    const newTopicList = this.topics().filter((_, i) => i !== index);
    this.topics.set(newTopicList);
    this.saveTopics(newTopicList);
  }

  private saveTopics(updatedTopics: TopicOfInterest[]) {
    this.isSavingTopics.set(true);
    
    // We send FormData now so topics need to be stringified
    const formData = new FormData();
    formData.append('topicsOfInterest', JSON.stringify(updatedTopics));

    this.quizService.updateCandidateProfile(formData).subscribe({
      next: (res) => {
        this.isSavingTopics.set(false);
        this.user.set(res.user);
      },
      error: () => {
        this.isSavingTopics.set(false);
        alert('Failed to update topics.');
      }
    });
  }

  // --- Profile Edit Management ---

  openEditProfile() {
    const currentUser = this.user();
    if (currentUser) {
      this.editName.set(currentUser.name || '');
      this.editEmail.set(currentUser.email || '');
      this.editPhone.set(currentUser.phoneNumber || '');
      this.selectedResume.set(null);
      this.isEditingProfile.set(true);
    }
  }

  closeEditProfile() {
    this.isEditingProfile.set(false);
    this.selectedResume.set(null);
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedResume.set(file);
    }
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
    
    const resumeFile = this.selectedResume();
    if (resumeFile) {
      formData.append('resume', resumeFile);
    }

    this.quizService.updateCandidateProfile(formData).subscribe({
      next: (res) => {
        this.user.set(res.user);
        this.isSavingProfile.set(false);
        this.closeEditProfile();
      },
      error: (err) => {
        console.error(err);
        alert(err.error?.message || 'Failed to update profile');
        this.isSavingProfile.set(false);
      }
    });
  }

  deleteResume() {
    if (confirm('Are you sure you want to delete your uploaded resume?')) {
      this.quizService.deleteCandidateResume().subscribe({
        next: (res) => {
          this.user.set(res.user);
        },
        error: (err) => {
          console.error(err);
          alert('Failed to delete resume');
        }
      });
    }
  }

  getResumeUrl(): string {
    const resume = this.user()?.resume;
    if (!resume) return '';
    // Assuming backend is running on 5000 and frontend on 4200 during dev
    // For prod, relative path usually works.
    // Let's use the API base URL logic or just relative path if proxied
    return `http://localhost:5000${resume}`;
  }
}
