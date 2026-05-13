import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ThemeService, ThemeMode } from '../../services/theme.service';
import { UiService } from '../../services/ui.service';

interface NavItem {
  icon: string;
  label: string;
  route: string;
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './layout.html',
  styleUrl: './layout.css'
})
export class LayoutComponent {
  authService = inject(AuthService);
  themeService = inject(ThemeService);
  router = inject(Router);
  uiService = inject(UiService);

  showThemeMenu = false;
  mobileSidebarOpen = false;

  themes: { id: ThemeMode; label: string; icon: string }[] = [
    { id: 'light', label: 'Light', icon: 'light_mode' },
    { id: 'dark', label: 'Dark', icon: 'dark_mode' },
    { id: 'blue', label: 'Navy', icon: 'water' }
  ];

  navItems = computed<NavItem[]>(() => {
    const role = this.authService.getUserRole();
    switch (role) {
      case 'admin':
        return [
          { icon: 'dashboard', label: 'Dashboard', route: '/admin/dashboard' },
          { icon: 'group', label: 'Users', route: '/admin/users' },
          { icon: 'quiz', label: 'Quizzes', route: '/admin/quizzes' },
          { icon: 'add_circle', label: 'Create Quiz', route: '/admin/create-quiz' },
          { icon: 'person', label: 'Profile', route: '/admin/profile' },
        ];
      case 'hr':
        return [
          { icon: 'dashboard', label: 'Dashboard', route: '/hr/dashboard' },
          { icon: 'quiz', label: 'My Quizzes', route: '/hr/quizzes' },
          { icon: 'add_circle', label: 'Create Quiz', route: '/hr/create-quiz' },
          { icon: 'people', label: 'Candidates', route: '/hr/users' },
          { icon: 'work', label: 'Interviews', route: '/hr/individual-interview' },
          { icon: 'person', label: 'Profile', route: '/hr/profile' },
        ];
      case 'pm':
        return [
          { icon: 'dashboard', label: 'Dashboard', route: '/pm/dashboard' },
          { icon: 'person_search', label: 'Individual', route: '/pm/individual-interview' },
          { icon: 'groups', label: 'Group', route: '/pm/group-interview' },
          { icon: 'person', label: 'Profile', route: '/pm/profile' },
        ];
      case 'interviewer':
        return [
          { icon: 'dashboard', label: 'Dashboard', route: '/interviewer/dashboard' },
          { icon: 'person_search', label: 'Individual', route: '/interviewer/individual-interview' },
          { icon: 'groups', label: 'Group', route: '/interviewer/group-interview' },
          { icon: 'person', label: 'Profile', route: '/interviewer/profile' },
        ];
      case 'candidate':
        return [
          { icon: 'dashboard', label: 'Dashboard', route: '/candidate/dashboard' },
          { icon: 'person', label: 'Profile', route: '/candidate/profile' },
        ];
      default:
        return [];
    }
  });

  roleBadge = computed(() => {
    const role = this.authService.getUserRole();
    switch (role) {
      case 'admin': return { label: 'Admin', class: 'role-admin' };
      case 'hr': return { label: 'HR', class: 'role-hr' };
      case 'candidate': return { label: 'Candidate', class: 'role-candidate' };
      case 'pm': return { label: 'PM', class: 'role-pm' };
      case 'interviewer': return { label: 'Interviewer', class: 'role-interviewer' };
      default: return { label: '', class: '' };
    }
  });

  userInitial = computed(() => {
    return this.authService.currentUser()?.name?.charAt(0)?.toUpperCase() || '?';
  });

  setTheme(theme: ThemeMode): void {
    this.themeService.setTheme(theme);
    this.showThemeMenu = false;
  }

  toggleThemeMenu(): void {
    this.showThemeMenu = !this.showThemeMenu;
  }

  toggleMobileSidebar(): void {
    this.mobileSidebarOpen = !this.mobileSidebarOpen;
  }

  logout(): void {
    this.authService.logout();
  }

  handleNavClick(item: NavItem, event: Event): void {
    if (item.route === '/admin/users' || item.route === '/hr/users') {
      event.preventDefault();
      this.uiService.showManageUsersPopup.set(true);
    } else {
      this.mobileSidebarOpen = false;
    }
  }

  closeManageUsersPopup(): void {
    this.uiService.showManageUsersPopup.set(false);
  }

  getUsersRoute(): string {
    return this.authService.getUserRole() === 'hr' ? '/hr/users' : '/admin/users';
  }

  getManageGroupsRoute(): string {
    return this.authService.getUserRole() === 'hr' ? '/hr/manage-groups' : '/admin/manage-groups';
  }

  getIndividualInterviewRoute(): string {
    const role = this.authService.getUserRole();
    if (role === 'hr') return '/hr/individual-interview';
    if (role === 'pm') return '/pm/individual-interview';
    if (role === 'interviewer') return '/interviewer/individual-interview';
    return '/admin/individual-interview';
  }

  getGroupInterviewRoute(): string {
    const role = this.authService.getUserRole();
    if (role === 'hr') return '/hr/group-interview';
    if (role === 'pm') return '/pm/group-interview';
    if (role === 'interviewer') return '/interviewer/group-interview';
    return '/admin/group-interview';
  }
}
