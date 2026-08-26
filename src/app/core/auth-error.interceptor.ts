// core/auth-error.interceptor.ts
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const code = error?.error?.error?.code;

      if (code === 'INVALID_TOKEN' || code === 'UNAUTHENTICATED') {
        // Clears the real token key + in-memory signal (previously this
        // removed localStorage key 'token', which doesn't exist — the
        // real key is 'sp3_identity_admin_token' — so the stale token
        // never actually got cleared and auth.guard.ts kept treating the
        // user as logged in after a "session expired" redirect.
        authService.clear({ sessionExpired: true });
      }

      // Re-throw so component-level error handlers (like your
      // notificationModal.open(...) calls) still run as normal
      return throwError(() => error);
    }),
  );
};
