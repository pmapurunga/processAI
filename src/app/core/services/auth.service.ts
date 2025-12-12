import { Injectable, inject } from '@angular/core';
import { Auth, signInWithPopup, GoogleAuthProvider, signOut, authState, User, onAuthStateChanged } from '@angular/fire/auth';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private auth: Auth = inject(Auth);
  private router = inject(Router);
  public readonly user$: Observable<User | null> = authState(this.auth);

  constructor() {
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        console.log('Authentication state changed: User is logged in', user);
        this.router.navigate(['/process-list']);
      } else {
        console.log('Authentication state changed: User is logged out');
        this.router.navigate(['/login']);
      }
    });
  }

  async loginWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(this.auth, provider);
      // The onAuthStateChanged observer will handle the redirect
    } catch (error: any) {
      console.error('Login failed. Detailed error report:');

      // Log the full error object to inspect all properties
      console.dir(error);

      if (error.code) {
        console.error('Error Code:', error.code);
      }
      if (error.message) {
        console.error('Error Message:', error.message);
      }
      if (error.customData) {
        console.error('Custom Data:', error.customData);
      }
    }
  }

  logout(): Promise<void> {
    return signOut(this.auth);
  }
}
