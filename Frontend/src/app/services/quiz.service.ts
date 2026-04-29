  import { Injectable } from '@angular/core';
  import { HttpClient } from '@angular/common/http';
  import { Observable } from 'rxjs';

  @Injectable({
    providedIn: 'root'
  })
  export class QuizService {
    private adminUrl = 'http://localhost:5000/api/admin';
    private hrUrl = 'http://localhost:5000/api/hr';
    private candidateUrl = 'http://localhost:5000/api/candidate';

    constructor(private http: HttpClient) {}

    // ========== ADMIN ENDPOINTS ==========

    getAdminStats(): Observable<any> {
      return this.http.get(`${this.adminUrl}/stats`);
    }

    getUsers(role?: string): Observable<any> {
      const url = role ? `${this.getBaseUrl()}/users?role=${role}` : `${this.getBaseUrl()}/users`;
      return this.http.get(url);
    }

    getLoggedInUsers(): Observable<any> {
      return this.http.get(`${this.getBaseUrl()}/users/logged-in`);
    }

    createHRUser(data: { name: string; email: string; password: string }): Observable<any> {
      return this.http.post(`${this.adminUrl}/users/create-hr`, data); // Only admin can create HR
    }

    deleteUser(userId: string): Observable<any> {
      return this.http.delete(`${this.getBaseUrl()}/users/${userId}`);
    }

    editUser(userId: string, data: { name?: string; email?: string; password?: string }): Observable<any> {
      return this.http.put(`${this.getBaseUrl()}/users/${userId}`, data);
    }

    getUserHistory(userId: string): Observable<any> {
      // In HR route it is /candidates/:userId/history but let's check backend hr.js
      // Wait, hr.js has /candidates/:userId/history and /candidates instead of /users for HR?
      // No, hr.js has /users, /users/logged-in, /users/:userId, etc.
      // Wait, let's verify.
      return this.http.get(`${this.getBaseUrl()}/users/${userId}/history`);
    }

    updateUserLevel(userId: string, level: string, role: string = 'admin'): Observable<any> {
      return this.http.put(`${this.getBaseUrl()}/users/${userId}/level`, { level });
    }

    getSubmissionDetails(submissionId: string): Observable<any> {
      return this.http.get(`${this.getBaseUrl()}/submissions/${submissionId}`);
    }

    createQuiz(formData: FormData): Observable<any> {
      return this.http.post(`${this.adminUrl}/quiz/create`, formData);
    }

    createQuizManual(data: any): Observable<any> {
      return this.http.post(`${this.adminUrl}/quiz/create-manual`, data);
    }

    generateAIQuiz(data: any): Observable<any> {
      return this.http.post(`${this.adminUrl}/quiz/generate-ai`, data);
    }

    getAdminQuizzes(): Observable<any> {
      return this.http.get(`${this.adminUrl}/quizzes`);
    }

    getAdminQuiz(quizId: string): Observable<any> {
      return this.http.get(`${this.adminUrl}/quiz/${quizId}`);
    }

    updateQuiz(quizId: string, data: any): Observable<any> {
      return this.http.put(`${this.adminUrl}/quiz/${quizId}`, data);
    }

    assignQuiz(quizId: string, data: any): Observable<any> {
      return this.http.put(`${this.adminUrl}/quiz/${quizId}/assign`, data);
    }

    getAssignCandidates(quizId: string): Observable<any> {
      return this.http.get(`${this.adminUrl}/quiz/${quizId}/assign-candidates`);
    }

    deleteQuiz(quizId: string): Observable<any> {
      return this.http.delete(`${this.adminUrl}/quiz/${quizId}`);
    }

    getAdminCategories(): Observable<any> {
      return this.http.get(`${this.adminUrl}/categories`);
    }

    getAdminGroups(): Observable<any> {
      return this.http.get(`${this.adminUrl}/groups`);
    }

    // ========== HR ENDPOINTS ==========

    getHRStats(): Observable<any> {
      return this.http.get(`${this.hrUrl}/stats`);
    }

    getHRQuizzes(): Observable<any> {
      return this.http.get(`${this.hrUrl}/quizzes`);
    }

    getHRQuiz(quizId: string): Observable<any> {
      return this.http.get(`${this.hrUrl}/quiz/${quizId}`);
    }

    createHRQuiz(formData: FormData): Observable<any> {
      return this.http.post(`${this.hrUrl}/quiz/create`, formData);
    }

    createHRQuizManual(data: any): Observable<any> {
      return this.http.post(`${this.hrUrl}/quiz/create-manual`, data);
    }

    updateHRQuiz(quizId: string, data: any): Observable<any> {
      return this.http.put(`${this.hrUrl}/quiz/${quizId}`, data);
    }

    deleteHRQuiz(quizId: string): Observable<any> {
      return this.http.delete(`${this.hrUrl}/quiz/${quizId}`);
    }

    getHRCandidates(): Observable<any> {
      return this.http.get(`${this.hrUrl}/candidates`);
    }

    getHRCandidateHistory(userId: string): Observable<any> {
      return this.http.get(`${this.hrUrl}/candidates/${userId}/history`);
    }

    getHRSubmissionDetails(submissionId: string): Observable<any> {
      return this.http.get(`${this.hrUrl}/submissions/${submissionId}`);
    }

    getHRCategories(): Observable<any> {
      return this.http.get(`${this.hrUrl}/categories`);
    }

    getHRGroups(): Observable<any> {
      return this.http.get(`${this.hrUrl}/groups`);
    }

    assignHRQuiz(quizId: string, data: any): Observable<any> {
      return this.http.put(`${this.hrUrl}/quiz/${quizId}/assign`, data);
    }

    getHRAssignCandidates(quizId: string): Observable<any> {
      return this.http.get(`${this.hrUrl}/quiz/${quizId}/assign-candidates`);
    }

    generateHRAIQuiz(data: any): Observable<any> {
      return this.http.post(`${this.hrUrl}/quiz/generate-ai`, data);
    }

    // ========== CANDIDATE ENDPOINTS ==========

    getAvailableQuizzes(): Observable<any> {
      return this.http.get(`${this.candidateUrl}/quizzes`);
    }

    getQuizForTaking(quizId: string): Observable<any> {
      return this.http.get(`${this.candidateUrl}/quiz/${quizId}`);
    }

    submitQuiz(quizId: string, answers: any[], timeTaken: number): Observable<any> {
      return this.http.post(`${this.candidateUrl}/quiz/${quizId}/submit`, { answers, timeTaken });
    }

    getCandidateProfile(): Observable<any> {
      return this.http.get(`${this.candidateUrl}/profile`);
    }

    updateCandidateProfile(data: any): Observable<any> {
      return this.http.put(`${this.candidateUrl}/profile`, data);
    }

    deleteCandidateResume(): Observable<any> {
      return this.http.delete(`${this.candidateUrl}/profile/resume`);
    }

    getResultDetails(submissionId: string): Observable<any> {
      return this.http.get(`${this.candidateUrl}/results/${submissionId}`);
    }

    // ========== GENERIC GROUP MANAGEMENT ==========
    
    private getBaseUrl(): string {
      const userStr = sessionStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          if (user.role === 'hr') return this.hrUrl;
        } catch (e) {}
      }
      return this.adminUrl;
    }

    createGroup(name: string): Observable<any> {
      return this.http.post(`${this.getBaseUrl()}/groups`, { name });
    }

    getGroups(): Observable<any> {
      return this.http.get(`${this.getBaseUrl()}/groups`);
    }

    updateGroup(oldName: string, newName: string): Observable<any> {
      return this.http.put(`${this.getBaseUrl()}/groups/${encodeURIComponent(oldName)}`, { newName });
    }

    deleteGroup(name: string): Observable<any> {
      return this.http.delete(`${this.getBaseUrl()}/groups/${encodeURIComponent(name)}`);
    }

    assignUserGroup(userId: string, groupName: string): Observable<any> {
      return this.http.put(`${this.getBaseUrl()}/users/${userId}/group`, { group: groupName });
    }
  }
