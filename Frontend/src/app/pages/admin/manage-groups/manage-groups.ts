import { Component, signal, OnInit, computed } from '@angular/core';
import { Location } from '@angular/common';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QuizService } from '../../../services/quiz.service';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-manage-groups',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './manage-groups.html',
  styleUrl: './manage-groups.css'
})
export class ManageGroupsComponent implements OnInit {
  groups = signal<string[]>([]);
  allStudents = signal<any[]>([]);
  
  newGroupName = signal<string>('');
  loading = signal<boolean>(false);
  error = signal<string>('');
  success = signal<string>('');
  loadingGroups = signal<boolean>(true);

  editingGroup = signal<string | null>(null);
  editName = signal<string>('');

  expandedGroup = signal<string | null>(null);

  unassignedStudents = computed(() => {
    return this.allStudents().filter(s => !s.group || s.group === 'General');
  });

  constructor(private quizService: QuizService, private location: Location) {}

  goBack(): void {
    this.location.back();
  }

  ngOnInit(): void {
    this.loadGroups();
    this.loadStudents();
  }

  loadGroups(): void {
    this.loadingGroups.set(true);
    this.quizService.getGroups().subscribe({
      next: (res) => {
        this.groups.set(res.groups || []);
        this.loadingGroups.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load groups');
        this.loadingGroups.set(false);
      }
    });
  }

  loadStudents(): void {
    this.quizService.getUsers('candidate').subscribe({
      next: (res) => {
        // Since getUsers('candidate') might not exist perfectly on HR route if we don't change HR route, wait, HR route has getHRCandidates
        // Let's rely on standard getUsers which points to getBaseUrl()/users depending on role if properly set. Actually quiz.service.ts uses adminUrl directly for getUsers. Let's see. I will dynamically fetch.
        this.allStudents.set(res.users ? res.users.filter((u:any) => u.role === 'candidate') : (res.candidates || []));
      },
      error: () => {}
    });
  }

  getStudentsInGroup(groupName: string): any[] {
    return this.allStudents().filter(s => s.group === groupName);
  }

  toggleGroupExpansion(groupName: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (this.expandedGroup() === groupName) {
      this.expandedGroup.set(null);
    } else {
      this.expandedGroup.set(groupName);
    }
  }

  createGroup(): void {
    if (!this.newGroupName().trim()) {
      this.error.set('Group name cannot be blank');
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.success.set('');

    this.quizService.createGroup(this.newGroupName()).subscribe({
      next: () => {
        this.success.set('Group created successfully!');
        this.loading.set(false);
        this.newGroupName.set('');
        this.loadGroups();
      },
      error: (err: any) => {
        this.error.set(err.error?.message || 'Failed to create group');
        this.loading.set(false);
      }
    });
  }

  startEdit(name: string): void {
    this.editingGroup.set(name);
    this.editName.set(name);
  }

  cancelEdit(): void {
    this.editingGroup.set(null);
  }

  saveEdit(oldName: string): void {
    const trimmed = this.editName().trim();
    if (!trimmed || trimmed === oldName) {
      this.cancelEdit();
      return;
    }

    this.error.set('');
    this.success.set('');
    this.quizService.updateGroup(oldName, trimmed).subscribe({
      next: () => {
        this.success.set('Group updated successfully!');
        this.cancelEdit();
        this.loadGroups();
        // Update local students cache
        this.allStudents.update(students => 
           students.map(s => s.group === oldName ? { ...s, group: trimmed } : s)
        );
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Failed to update group');
      }
    });
  }

  deleteGroup(name: string): void {
    if (confirm(`Are you sure you want to delete the group "${name}"?\nUsers mapped to this group will moved to Unassigned.`)) {
      this.error.set('');
      this.success.set('');
      this.quizService.deleteGroup(name).subscribe({
        next: () => {
          this.success.set('Group deleted successfully!');
          this.loadGroups();
          // Move students to General
          this.allStudents.update(students => 
             students.map(s => s.group === name ? { ...s, group: 'General' } : s)
          );
        },
        error: (err) => {
          this.error.set(err.error?.message || 'Failed to delete group');
        }
      });
    }
  }

  onDrop(event: CdkDragDrop<string>) {
    if (event.previousContainer === event.container) {
      return; // No change
    }
    
    const student = event.item.data;
    const previousGroup = event.previousContainer.data;
    const newGroup = event.container.data;

    this.allStudents.update(students => 
       students.map(s => s._id === student._id ? { ...s, group: newGroup } : s)
    );

    this.quizService.assignUserGroup(student._id, newGroup).subscribe({
       next: () => {
          // Success
          this.success.set(``);
       },
       error: () => {
          this.error.set('Failed to assign user to group');
          this.loadStudents(); 
       }
    });
  }

  removeFromGroup(student: any) {
    this.allStudents.update(students => 
       students.map(s => s._id === student._id ? { ...s, group: 'General' } : s)
    );
    this.quizService.assignUserGroup(student._id, 'General').subscribe({
       next: () => {},
       error: () => this.loadStudents()
    });
  }
}
