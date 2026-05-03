import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class UiService {
  showManageUsersPopup = signal<boolean>(false);
  showInterviewPopup = signal<boolean>(false);
}
