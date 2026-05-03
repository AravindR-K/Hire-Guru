import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Generic auth guard - just checks if logged in
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }
  return true;
};

// Admin only
export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }

  if (authService.getUserRole() !== 'admin') {
    router.navigate([authService.getDashboardRoute()]);
    return false;
  }

  return true;
};

// HR only
export const hrGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }

  if (authService.getUserRole() !== 'hr') {
    router.navigate([authService.getDashboardRoute()]);
    return false;
  }

  return true;
};

// Candidate only
export const candidateGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }

  if (authService.getUserRole() !== 'candidate') {
    router.navigate([authService.getDashboardRoute()]);
    return false;
  }

  return true;
};

// Admin or HR
export const adminOrHrGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }

  const role = authService.getUserRole();
  if (role !== 'admin' && role !== 'hr') {
    router.navigate([authService.getDashboardRoute()]);
    return false;
  }

  return true;
};

// Guest only (redirect logged-in users to their dashboard)
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    router.navigate([authService.getDashboardRoute()]);
    return false;
  }

  return true;
};

// Project Manager only
export const pmGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }

  if (authService.getUserRole() !== 'pm') {
    router.navigate([authService.getDashboardRoute()]);
    return false;
  }

  return true;
};

// Interviewer only
export const interviewerGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }

  if (authService.getUserRole() !== 'interviewer') {
    router.navigate([authService.getDashboardRoute()]);
    return false;
  }

  return true;
};
