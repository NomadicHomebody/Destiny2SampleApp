import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { map, catchError, switchMap } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { LoggingService } from '../../../../core/services/logging.service';

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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private elementRef: ElementRef,
    private loggingService: LoggingService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}
  
  // Method for checking in template
  isPlatformBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const code = params['code'];
      const state = params['state'];
      const error = params['error'];
      
      if (error) {
        this.error = `Authentication failed: ${error}`;
        this.processing = false;
        return;
      }
      
      if (!code) {
        this.error = 'No authorization code received from Bungie';
        this.processing = false;
        return;
      }
      
      // Exchange code for token
      this.getAccessToken(code, state);
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
  
  private getRedirectUrl(): string {
    if (!isPlatformBrowser(this.platformId)) return environment.bungie.redirectUrl;
    
    const config = environment.bungie.redirectConfig;
    if (!config) return environment.bungie.redirectUrl;
    
    const protocol = window.location.protocol.replace(':', '');
    const host = window.location.host;
    return `${protocol}://${host}${config.path || '/auth/callback'}`;
  }

  private getAccessToken(code: string, state: string): void {
    const redirectUrl = environment.bungie.redirectConfig?.useCurrentHost ?
      this.getRedirectUrl() : environment.bungie.redirectUrl;
      
    const tokenRequest = {
      grant_type: 'authorization_code',
      code: code,
      client_id: environment.bungie.clientId,
      client_secret: environment.bungie.clientSecret,
      redirect_uri: redirectUrl
    };
  
    // Make the token request
    this.http.post<any>(
      environment.bungie.tokenUrl, 
      tokenRequest, 
      { headers: new HttpHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' }) }
    ).pipe(
      map(response => {
        // Transform to URL encoded form data
        const body = new URLSearchParams();
        Object.keys(tokenRequest).forEach(key => {
          body.set(key, tokenRequest[key as keyof typeof tokenRequest]);
        });
        
        return this.http.post<any>(
          environment.bungie.tokenUrl,
          body.toString(),
          { headers: new HttpHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' }) }
        );
      }),
      switchMap(tokenObservable => tokenObservable),
      catchError(error => {
        this.loggingService.error(
          'CallbackComponent',
          'Failed to exchange authorization code for token',
          error,
          'AUTH_TOKEN_EXCHANGE_FAILED',
          { code: 'REDACTED' }
        );
        this.error = 'Authentication failed: Unable to retrieve token';
        this.processing = false;
        return throwError(() => error);
      })
    ).subscribe({
      next: (tokenResponse) => {
        this.loggingService.info('CallbackComponent', 'Successfully retrieved token');
        
        // Store token in localStorage
        localStorage.setItem('authToken', tokenResponse.access_token);
        localStorage.setItem('refreshToken', tokenResponse.refresh_token);
        localStorage.setItem('tokenExpiry', (Date.now() + (tokenResponse.expires_in * 1000)).toString());
        
        // Get user memberships to store primary membership info
        this.getUserMemberships(tokenResponse.access_token);
      },
      error: (err) => {
        this.error = 'Authentication failed: Unable to retrieve token';
        this.processing = false;
        this.loggingService.error(
          'CallbackComponent',
          'Token request failed',
          err,
          'AUTH_TOKEN_REQUEST_FAILED'
        );
      }
    });
  }
  
  private getUserMemberships(token: string): void {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'X-API-Key': environment.bungie.apiKey
    });
  
    this.http.get<any>(
      `${environment.bungie.apiRoot}/User/GetMembershipsForCurrentUser/`, 
      { headers }
    ).subscribe({
      next: (response) => {
        try {
          const data = response.Response;
          
          // Store membership info for later use
          if (data.destinyMemberships && data.destinyMemberships.length > 0) {
            const primaryMembership = data.destinyMemberships[0];
            localStorage.setItem('membershipId', primaryMembership.membershipId);
            localStorage.setItem('membershipType', primaryMembership.membershipType.toString());
            
            // Get characters for this membership
            this.getCharacters(token, primaryMembership.membershipType, primaryMembership.membershipId);
          } else {
            this.loggingService.warn(
              'CallbackComponent',
              'No Destiny memberships found for user'
            );
            this.redirectToVault();
          }
        } catch (error) {
          this.loggingService.error(
            'CallbackComponent',
            'Error processing user memberships data',
            error,
            'AUTH_MEMBERSHIP_PROCESSING_ERROR'
          );
          this.redirectToVault();
        }
      },
      error: (err) => {
        this.loggingService.error(
          'CallbackComponent',
          'Failed to retrieve user memberships',
          err,
          'AUTH_GET_MEMBERSHIPS_FAILED'
        );
        this.redirectToVault();
      }
    });
  }
  
  private getCharacters(token: string, membershipType: number, membershipId: string): void {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'X-API-Key': environment.bungie.apiKey
    });
  
    this.http.get<any>(
      `${environment.bungie.apiRoot}/Destiny2/${membershipType}/Profile/${membershipId}/?components=200`,
      { headers }
    ).subscribe({
      next: (response) => {
        try {
          const data = response.Response;
          if (data.characters && data.characters.data) {
            const characterIds = Object.keys(data.characters.data);
            if (characterIds.length > 0) {
              // Store the first character ID
              localStorage.setItem('characterId', characterIds[0]);
              this.loggingService.info(
                'CallbackComponent',
                'Successfully retrieved character information',
                { characterCount: characterIds.length }
              );
            }
          }
        } catch (error) {
          this.loggingService.error(
            'CallbackComponent',
            'Error processing character data',
            error,
            'AUTH_CHARACTER_PROCESSING_ERROR'
          );
        }
        this.redirectToVault();
      },
      error: (err) => {
        this.loggingService.error(
          'CallbackComponent',
          'Failed to retrieve character data',
          err,
          'AUTH_GET_CHARACTERS_FAILED'
        );
        this.redirectToVault();
      }
    });
  }
  
  private redirectToVault(): void {
    this.loggingService.info('CallbackComponent', 'Redirecting to vault page');
    this.router.navigate(['/vault']);
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