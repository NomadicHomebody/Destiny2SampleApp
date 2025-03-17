import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Dynamic routes with parameters should use client-side rendering
  {
    path: 'vault/item/:id',
    renderMode: RenderMode.Client
  },
  // Static routes can use prerendering for better performance
  {
    path: 'auth/**',
    renderMode: RenderMode.Prerender
  },
  {
    path: 'vault',
    renderMode: RenderMode.Prerender
  },
  // Fallback for other routes - server-side rendering
  {
    path: '**',
    renderMode: RenderMode.Server
  }
];