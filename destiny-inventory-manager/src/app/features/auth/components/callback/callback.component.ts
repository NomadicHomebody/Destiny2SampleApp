import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

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
  
    // Rest of the method remains the same...
  }
  
  private getRedirectUrl(): string {
    if (!isPlatformBrowser(this.platformId)) return environment.bungie.redirectUrl;
    
    const config = environment.bungie.redirectConfig;
    if (!config) return environment.bungie.redirectUrl;
    
    const protocol = window.location.protocol.replace(':', '');
    const host = window.location.host;
    return `${protocol}://${host}${config.path || '/auth/callback'}`;
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