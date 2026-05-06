import { Injectable } from '@angular/core';
import { BehaviorSubject, Subscription, timer } from 'rxjs';

export interface ToastMessage {
  readonly message: string;
  readonly variant: 'success' | 'error';
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private readonly toastSubject = new BehaviorSubject<ToastMessage | null>(null);
  private dismissSubscription = Subscription.EMPTY;

  readonly toast$ = this.toastSubject.asObservable();

  showSuccess(message: string): void {
    this.show({ message, variant: 'success' });
  }

  showError(message: string): void {
    this.show({ message, variant: 'error' });
  }

  clear(): void {
    this.dismissSubscription.unsubscribe();
    this.toastSubject.next(null);
  }

  private show(toast: ToastMessage): void {
    this.dismissSubscription.unsubscribe();
    this.toastSubject.next(toast);
    this.dismissSubscription = timer(3000).subscribe(() => this.toastSubject.next(null));
  }
}
