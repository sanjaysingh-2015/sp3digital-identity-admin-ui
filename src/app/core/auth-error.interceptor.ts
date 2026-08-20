// core/auth-error.interceptor.ts
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const code = error?.error?.error?.code;

      if (code === 'INVALID_TOKEN' || code === 'UNAUTHENTICATED') {
        // Clear whatever session/token you store client-side
        localStorage.removeItem('token');

        router.navigate(['/login'], {
          queryParams: { sessionExpired: true },
        });
      }

      // Re-throw so component-level error handlers (like your
      // notificationModal.open(...) calls) still run as normal
      return throwError(() => error);
    }),
  );
};