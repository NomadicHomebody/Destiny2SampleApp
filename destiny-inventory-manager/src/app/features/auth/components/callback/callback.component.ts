import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { map, catchError, switchMap, finalize } from 'rxjs/operators';
import { throwError, of, timer } from 'rxjs';
import { LoggingService } from '../../../../core/services/logging.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-callback',
  templateUrl: './callback.component.html',
  styleUrls: ['./callback.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class CallbackComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  
  error: string | null = null;
  processing = true;
  private particles: Particle[] = [];
  private ctx!: CanvasRenderingContext2D;
  private animationId: number = 0;
  private mouse = { x: 0, y: 0 };
  private codeProcessed = false; // Flag to prevent code reuse
  private processingTimeout: any = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private elementRef: ElementRef,
    private loggingService: LoggingService,
    private authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}
  
  // Method for checking in template
  isPlatformBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    // Set a safety timeout to redirect to vault after 8 seconds even if auth is still processing
    // This helps in case profile loading is slow or fails but token was obtained
    this.processingTimeout = setTimeout(() => {
      if (this.processing && isPlatformBrowser(this.platformId) && localStorage.getItem('authToken')) {
        this.loggingService.warn('CallbackComponent', 'Auth processing timeout reached, redirecting to vault');
        this.processing = false;
        this.router.navigate(['/vault']);
      }
    }, 8000);
    
    this.route.queryParams.subscribe(params => {
      const code = params['code'];
      const state = params['state'];
      const error = params['error'];
      
      if (error) {
        this.error = `Authentication failed: ${error}`;
        this.processing = false;
        this.loggingService.error('CallbackComponent', `Authentication error from Bungie: ${error}`);
        return;
      }
      
      if (!code) {
        this.error = 'No authorization code received from Bungie';
        this.processing = false;
        this.loggingService.error('CallbackComponent', 'No authorization code in callback URL');
        return;
      }
      
      // Validate state parameter to prevent CSRF
      if (isPlatformBrowser(this.platformId)) {
        const storedState = sessionStorage.getItem('auth_state');
        if (storedState && state !== storedState) {
          this.error = 'Security validation failed. Please try logging in again.';
          this.processing = false;
          this.loggingService.error('CallbackComponent', 'State parameter mismatch', null, 'CSRF_ATTEMPT');
          return;
        }
      }
      
      // Prevent code reuse if the page is refreshed
      if (this.codeProcessed) {
        this.loggingService.warn('CallbackComponent', 'Authorization code already processed, preventing reuse');
        this.error = 'This authorization response has already been processed. Please try logging in again.';
        this.processing = false;
        return;
      }
      
      this.codeProcessed = true;
      
      // Use the AuthService to handle the token exchange
      this.authService.handleCallback(code).subscribe({
        next: (success) => {
          if (success) {
            this.loggingService.info('CallbackComponent', 'Authentication successful');
            // Clear the timeout since we're redirecting now
            if (this.processingTimeout) {
              clearTimeout(this.processingTimeout);
              this.processingTimeout = null;
            }
            this.router.navigate(['/vault']);
          } else {
            this.error = 'Authentication failed. Please try again.';
            this.processing = false;
          }
        },
        error: (err) => {
          this.error = 'Authentication failed. Please try again.';
          this.processing = false;
          
          this.loggingService.error(
            'CallbackComponent',
            'Authentication error',
            err,
            'AUTH_CALLBACK_ERROR',
            { code: 'REDACTED' } // Don't log the actual code
          );
        },
        complete: () => {
          // Clear any timeout to prevent navigation conflicts
          if (this.processingTimeout) {
            clearTimeout(this.processingTimeout);
            this.processingTimeout = null;
          }
        }
      });
    });
    
    if (isPlatformBrowser(this.platformId)) {
      window.addEventListener('mousemove', this.handleMouseMove);
      window.addEventListener('resize', this.handleResize);
    }
  }
  
  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId) && this.canvasRef && this.canvasRef.nativeElement) {
      this.initCanvas();
    }
  }
  
  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.cancelAnimationFrame(this.animationId);
      window.removeEventListener('mousemove', this.handleMouseMove);
      window.removeEventListener('resize', this.handleResize);
    }
    
    // Clear timeout if component is destroyed
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
      this.processingTimeout = null;
    }
  }
  
  private handleMouseMove = (e: MouseEvent) => {
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
  }
  
  private handleResize = () => {
    if (this.canvasRef && this.canvasRef.nativeElement) {
      this.initCanvas();
    }
  }
  
  private initCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    
    // Set canvas to full window size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Initialize particles
    this.createParticles();
    
    // Start animation
    this.animate();
  }
  
  private createParticles(): void {
    this.particles = [];
    const particleCount = Math.min(80, Math.floor(window.innerWidth * window.innerHeight / 12000));
    
    for (let i = 0; i < particleCount; i++) {
      this.particles.push(new Particle(
        Math.random() * this.canvasRef.nativeElement.width,
        Math.random() * this.canvasRef.nativeElement.height,
        Math.random() * 2 + 1,
        this.getRandomColor()
      ));
    }
  }
  
  private getRandomColor(): string {
    // Use the same color palette as the login component for consistency
    const colors = [
      'rgba(211, 84, 0, 0.5)',    // Orange (primary)
      'rgba(230, 126, 34, 0.3)',   // Light orange
      'rgba(41, 128, 185, 0.3)',   // Blue accent
      'rgba(46, 204, 113, 0.2)'    // Green accent
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
  
  private animate = (): void => {
    this.animationId = window.requestAnimationFrame(this.animate);
    this.ctx.clearRect(0, 0, this.canvasRef.nativeElement.width, this.canvasRef.nativeElement.height);
    
    // Update and draw particles
    for (const particle of this.particles) {
      // Move particle toward mouse with subtle effect
      const dx = this.mouse.x - particle.x;
      const dy = this.mouse.y - particle.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const forceDirectionX = dx / distance;
      const forceDirectionY = dy / distance;
      const maxDistance = 200;
      const force = (maxDistance - distance) / maxDistance;
      
      if (distance < maxDistance && force > 0) {
        particle.vx += forceDirectionX * force * 0.2;
        particle.vy += forceDirectionY * force * 0.2;
      }
      
      // Add friction to slow particles
      particle.vx *= 0.98;
      particle.vy *= 0.98;
      
      // Update position
      particle.x += particle.vx;
      particle.y += particle.vy;
      
      // Boundary check
      if (particle.x < 0 || particle.x > this.canvasRef.nativeElement.width) {
        particle.vx = -particle.vx;
      }
      if (particle.y < 0 || particle.y > this.canvasRef.nativeElement.height) {
        particle.vy = -particle.vy;
      }
      
      // Draw particle
      particle.draw(this.ctx);
    }
  }
}

class Particle {
  vx: number = 0;
  vy: number = 0;
  
  constructor(
    public x: number,
    public y: number,
    public radius: number,
    public color: string
  ) {
    this.vx = Math.random() * 0.4 - 0.2;
    this.vy = Math.random() * 0.4 - 0.2;
  }
  
  draw(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    
    // Add glow effect
    ctx.shadowBlur = 5;
    ctx.shadowColor = this.color;
  }
}