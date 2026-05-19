import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'hr' | 'candidate' | 'pm' | 'interviewer';
  group?: string;
}

export interface AuthResponse {
  message: string;
  token?: string;
  user: User;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:5000/api/auth';
  
  currentUser = signal<User | null>(null);
  isLoggedIn = signal<boolean>(false);

  constructor(private http: HttpClient, private router: Router) {
    this.loadUserFromStorage();
  }

  private loadUserFromStorage(): void {
    const token = sessionStorage.getItem('token');
    const user = sessionStorage.getItem('user');  
    if (token && user) {
      this.currentUser.set(JSON.parse(user));
      this.isLoggedIn.set(true);
    }
  }

  getRegistrationGroups(): Observable<any> {
    return this.http.get(`${this.apiUrl}/groups`);
  }

  register(name: string, email: string, password: string, group?: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, { name, email, password, group });
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, { email, password })
      .pipe(tap(res => this.handleAuth(res)));
  }

  getMe(): Observable<any> {
    return this.http.get(`${this.apiUrl}/me`);
  }

  uploadSignature(payload: { signature: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/signature`, payload);
  }

  updateProfile(formData: FormData): Observable<any> {
    return this.http.put(`${this.apiUrl}/profile`, formData);
  }

  logout(): void {
    const token = sessionStorage.getItem('token');  
    if (token) {
      this.http.post(`${this.apiUrl}/logout`, {}).subscribe({
        complete: () => this.clearAuth(),
        error: () => this.clearAuth()
      });
    } else {
      this.clearAuth();
    }
  }

  private handleAuth(res: AuthResponse): void {
    if (res.token) {
      sessionStorage.setItem('token', res.token);
    }
    sessionStorage.setItem('user', JSON.stringify(res.user)); 
    this.currentUser.set(res.user);
    this.isLoggedIn.set(true);
  }

  private clearAuth(): void {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    this.currentUser.set(null);
    this.isLoggedIn.set(false);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return sessionStorage.getItem('token'); 
  }

  getUserRole(): string | null {
    return this.currentUser()?.role || null;
  }

  getDashboardRoute(): string {
    const role = this.getUserRole();
    switch (role) {
      case 'admin': return '/admin/dashboard';
      case 'hr': return '/hr/dashboard';
      case 'candidate': return '/candidate/dashboard';
      case 'pm': return '/pm/dashboard';
      case 'interviewer': return '/interviewer/dashboard';
      default: return '/login';
    }
  }
}
