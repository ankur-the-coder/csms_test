
import { Component, signal, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
// import { Router } from '@angular/router'
// import { AuthService } from '../service/auth.service'
// import { environment } from '../../environments/environment'

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {



  @ViewChild('heroCanvas') heroCanvas!: ElementRef
  @ViewChild('staticLogo') staticLogo!: ElementRef

  username  = ''
  password  = ''
  isLoading = signal(false)
  errorMsg  = signal('')
  // brand = environment.brand

  private animFrameId: any
  private THREE: any
  showPassword = signal(false)

  showConflictModal = signal(false)
conflictDevice    = ''
kickedOutMsg      = signal('')
private pendingLoginData: any = null

togglePasswordVisibility() {
  this.showPassword.set(!this.showPassword())
}

  constructor() {}

// ngOnInit() {
//   if (this.auth.isLoggedIn()) this.router.navigate(['/'])

//   const reason = sessionStorage.getItem('logout_reason')
//   if (reason) {
//     sessionStorage.removeItem('logout_reason')
//     this.kickedOutMsg.set(reason)
//   }
// }

  ngAfterViewInit() {
    this.loadThreeAndInit()
  }

 private loadThreeAndInit() {
  // Load Three.js first
  const threeScript = document.createElement('script')
  threeScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
  threeScript.onload = () => this.injectOriginalScene()
  document.head.appendChild(threeScript)
}

private injectOriginalScene() {
  const script = document.createElement('script')
  script.textContent = this.getSceneScript()
  document.body.appendChild(script)
  // Store ref for cleanup
  this._injectedScript = script
}

private _injectedScript: HTMLScriptElement | null = null

  private initScene() {
    const THREE = this.THREE
    const heroContainer = this.heroCanvas?.nativeElement
    const staticContainer = this.staticLogo?.nativeElement
    if (!heroContainer || !staticContainer || !THREE) return

    // ── Static inline logo scene ──────────────────────────────────────────────
    const sceneStatic = new THREE.Scene()
    const rectStatic  = staticContainer.getBoundingClientRect()
    const cameraStatic = new THREE.PerspectiveCamera(45, rectStatic.width / rectStatic.height, 0.1, 100)
    cameraStatic.position.set(0, 0, 3.5)
    const rendererStatic = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    rendererStatic.setSize(rectStatic.width, rectStatic.height)
    rendererStatic.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    staticContainer.appendChild(rendererStatic.domElement)

    const ambientS = new THREE.AmbientLight(0xffffff, 0.6)
    sceneStatic.add(ambientS)
    const dirS = new THREE.DirectionalLight(0x00c853, 1.2)
    dirS.position.set(2, 3, 4)
    sceneStatic.add(dirS)

    const geoS = new THREE.IcosahedronGeometry(0.7, 1)
    const matS = new THREE.MeshPhysicalMaterial({ color: 0x00b046, transparent: true, opacity: 0.85, roughness: 0.1, metalness: 0.1 })
    const meshS = new THREE.Mesh(geoS, matS)
    sceneStatic.add(meshS)

    // ── Hero scene ────────────────────────────────────────────────────────────
    const sceneHero = new THREE.Scene()
    const cameraHero = new THREE.PerspectiveCamera(35, heroContainer.clientWidth / heroContainer.clientHeight, 0.1, 100)
    cameraHero.position.set(0, 0, 7)

    const rendererHero = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    rendererHero.setSize(heroContainer.clientWidth, heroContainer.clientHeight)
    rendererHero.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    rendererHero.setClearColor(0x000000, 0)
    heroContainer.appendChild(rendererHero.domElement)

    const ambient = new THREE.AmbientLight(0xffffff, 0.5)
    sceneHero.add(ambient)
    const dir1 = new THREE.DirectionalLight(0x00c853, 2.5)
    dir1.position.set(3, 5, 5)
    sceneHero.add(dir1)
    const dir2 = new THREE.DirectionalLight(0x0ea5e9, 1.5)
    dir2.position.set(-4, -2, 3)
    sceneHero.add(dir2)

    const interactiveLogoSystem = new THREE.Group()
    sceneHero.add(interactiveLogoSystem)

    const createMat = (hex: number) => new THREE.MeshPhysicalMaterial({
      color: hex, transparent: true, opacity: 0.78,
      roughness: 0.05, metalness: 0.05, transmission: 0.65,
      ior: 1.55, side: THREE.DoubleSide, depthWrite: false
    })

    const ballDefs = [
      { pos: [0, 0, 0],       scale: 0.88, color: 0x00b046 },
      { pos: [-1.8, 1.0, -0.5], scale: 0.55, color: 0x0ea5e9 },
      { pos: [1.8, 1.2, -0.3],  scale: 0.48, color: 0x00b046 },
      { pos: [-1.5, -1.3, 0.2], scale: 0.52, color: 0x6366f1 },
      { pos: [1.6, -1.0, 0.4],  scale: 0.45, color: 0x0ea5e9 },
      { pos: [0.3, 2.2, -0.6],  scale: 0.40, color: 0x6366f1 },
      { pos: [-0.4, -2.3, 0.1], scale: 0.38, color: 0x00b046 },
    ]

    ballDefs.forEach(d => {
      const geo  = new THREE.IcosahedronGeometry(d.scale, 2)
      const mat  = createMat(d.color)
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(d.pos[0], d.pos[1], d.pos[2])
      mesh.userData = {
        isBall: true, clickCount: 0, isAnimating: false, animTime: 0,
        isBlasting: false, blastTime: 0, shards: [],
        baseScale: { x: d.scale, y: d.scale, z: d.scale }
      }
      interactiveLogoSystem.add(mesh)
    })

    let trackPointerX = 0, trackPointerY = 0
    const clock = new THREE.Clock()

    const hintEl = document.getElementById('click-hint')
    const raycaster  = new THREE.Raycaster()
    const mouseVector = new THREE.Vector2()

    heroContainer.addEventListener('pointermove', (e: PointerEvent) => {
      trackPointerX = (e.clientX / window.innerWidth  - 0.5) * window.innerWidth
      trackPointerY = (e.clientY / window.innerHeight - 0.5) * window.innerHeight
    })

    heroContainer.addEventListener('pointerdown', (event: PointerEvent) => {
      const rect = heroContainer.getBoundingClientRect()
      mouseVector.x =  ((event.clientX - rect.left) / rect.width)  * 2 - 1
      mouseVector.y = -((event.clientY - rect.top)  / rect.height) * 2 + 1
      raycaster.setFromCamera(mouseVector, cameraHero)
      const hits = raycaster.intersectObjects(interactiveLogoSystem.children, true)
      if (!hits.length) return
      const obj = hits[0].object as any
      if (!obj.userData?.isBall) return
      if (obj.userData.isBlasting) return
      if (hintEl) hintEl.style.opacity = '0'
      obj.userData.clickCount++
      if (obj.userData.clickCount >= 3) {
        obj.userData.isBlasting = true; obj.userData.blastTime = 0
        obj.userData.isAnimating = false; obj.userData.clickCount = 0
        obj.visible = false
        const shardGeo = new THREE.TetrahedronGeometry(obj.userData.baseScale.x * 0.15)
        obj.userData.shards = []
        for (let i = 0; i < 80; i++) {
          const sm = new THREE.Mesh(shardGeo, obj.material)
          sm.position.copy(obj.position)
          sm.userData = {
            dir: new THREE.Vector3((Math.random()-0.5)*2,(Math.random()-0.5)*2,(Math.random()-0.5)*2).normalize(),
            rotSpeed: new THREE.Vector3(Math.random()*8,Math.random()*8,Math.random()*8)
          }
          interactiveLogoSystem.add(sm); obj.userData.shards.push(sm)
        }
      } else {
        obj.userData.isAnimating = true; obj.userData.animTime = 0
        clearTimeout(obj.userData.clickResetTimeout)
        obj.userData.clickResetTimeout = setTimeout(() => obj.userData.clickCount = 0, 1000)
      }
    })

    let internalRotationTargetX = 0, internalRotationTargetY = 0

    const animate = () => {
      this.animFrameId = requestAnimationFrame(animate)
      const elapsed = clock.getElapsedTime()

      meshS.rotation.y = elapsed * 0.4
      rendererStatic.render(sceneStatic, cameraStatic)

      internalRotationTargetX = trackPointerY * 0.001
      internalRotationTargetY = trackPointerX * 0.001
      interactiveLogoSystem.rotation.y += (internalRotationTargetY - interactiveLogoSystem.rotation.y) * 0.12
      interactiveLogoSystem.rotation.x += (internalRotationTargetX - interactiveLogoSystem.rotation.x) * 0.12

      interactiveLogoSystem.children.forEach((child: any) => {
        if (!child.userData) return
        if (child.userData.isAnimating) {
          child.userData.animTime += 0.016
          const t = child.userData.animTime
          if (t > 1.2) {
            child.userData.isAnimating = false
            child.scale.set(child.userData.baseScale.x, child.userData.baseScale.y, child.userData.baseScale.z)
          } else {
            const w = Math.sin(t * 22) * Math.exp(-t * 4.5) * 0.45
            child.scale.y = child.userData.baseScale.y * (1 + w)
            child.scale.x = child.userData.baseScale.x * (1 - w * 0.5)
            child.scale.z = child.userData.baseScale.z * (1 - w * 0.5)
          }
        }
        if (child.userData.isBlasting) {
          child.userData.blastTime += 0.016
          const t = child.userData.blastTime
          if (t >= 1.0) {
            child.userData.isBlasting = false; child.visible = true
            child.userData.shards.forEach((s: any) => { interactiveLogoSystem.remove(s); s.geometry.dispose() })
            child.userData.shards = []
          } else {
            const spread = Math.sin(t * Math.PI) * 1.6
            child.userData.shards.forEach((s: any) => {
              s.position.copy(child.position).addScaledVector(s.userData.dir, spread)
              s.rotation.x += s.userData.rotSpeed.x * 0.016
              s.rotation.y += s.userData.rotSpeed.y * 0.016
            })
          }
        }
        if (child.userData.isBall && !child.userData.isBlasting) {
          if (!child.userData.basePosition) child.userData.basePosition = child.position.clone()
          const seed = child.userData.basePosition.x * 3.5 + child.userData.basePosition.y * 2.0
          child.position.x = child.userData.basePosition.x + Math.sin(elapsed * 1.4 + seed) * 0.025
          child.position.y = child.userData.basePosition.y + Math.cos(elapsed * 1.7 + seed) * 0.025
          child.position.z = child.userData.basePosition.z + Math.sin(elapsed * 1.1 + seed) * 0.015
        }
      })

      if (hintEl && hintEl.style.opacity !== '0') {
        const centerBall = interactiveLogoSystem.children.find(
          (c: any) => c.userData?.baseScale?.x === 0.88
        ) as any
        if (centerBall) {
          const wp = new THREE.Vector3()
          centerBall.getWorldPosition(wp)
          wp.project(cameraHero)
          hintEl.style.left = `${(wp.x * 0.5 + 0.5) * heroContainer.clientWidth  - 28}px`
          hintEl.style.top  = `${(-wp.y * 0.5 + 0.5) * heroContainer.clientHeight - 180}px`
        }
      }

      rendererHero.render(sceneHero, cameraHero)
    }

    animate()

    window.addEventListener('resize', () => {
      if (heroContainer.clientWidth > 0) {
        const w = heroContainer.clientWidth, h = heroContainer.clientHeight
        cameraHero.aspect = w / h
        cameraHero.fov = w/h < 1.3 ? 35 * (1.3 / (w/h)) : 35
        cameraHero.updateProjectionMatrix()
        rendererHero.setSize(w, h)
      }
      const r2 = staticContainer.getBoundingClientRect()
      cameraStatic.aspect = r2.width / r2.height
      cameraStatic.updateProjectionMatrix()
      rendererStatic.setSize(r2.width, r2.height)
      rendererStatic.render(sceneStatic, cameraStatic)
    })
  }

//   submit() {
//     if (!this.username.trim() || !this.password.trim()) return
//     this.isLoading.set(true)
//     this.errorMsg.set('')
//     this.auth.login(this.username.trim(), this.password.trim()).subscribe({
// next: (r: any) => {
//   if (r?.status) {
//     if (r.data.alreadyLoggedIn) {
//       this.isLoading.set(false)
//       this.conflictDevice    = r.data.currentDevice ?? 'Unknown device'
//       this.pendingLoginData  = r.data
//       this.showConflictModal.set(true)   // show styled modal, not confirm()
//     } else {
//       // this.auth.saveSession(r.data.token, r.data.name, r.data.role, r.data.agentId)
//       // this.router.navigate(['/'])
//     }
//   } else {
//     this.errorMsg.set(r?.msg ?? 'Login failed')
//     this.isLoading.set(false)
//   }
// },
//       error: () => {
//         this.errorMsg.set('Server error. Please try again.')
//         this.isLoading.set(false)
//       }
//     })
//   }

  private getSceneScript(): string {
  return `
(function() {
  function createDarkenedPremiumGlassMaterial(hexColor) {
    return new THREE.MeshPhysicalMaterial({
      color: hexColor, transparent: true, opacity: 0.78,
      roughness: 0.05, metalness: 0.05, transmission: 0.65,
      ior: 1.55, side: THREE.DoubleSide, depthWrite: false,
      clearcoat: 1.0, clearcoatRoughness: 0.02
    });
  }

  function buildAestheticLogoTree() {
    const logoGroup = new THREE.Group();
    const structuralMat = new THREE.MeshStandardMaterial({ color: 0x0a0f18, roughness: 0.15, metalness: 0.85 });

    const baseShape = new THREE.Shape();
    baseShape.moveTo(-1.6, -1.45);
    baseShape.quadraticCurveTo(0, -1.26, 1.6, -1.45);
    baseShape.quadraticCurveTo(0, -1.36, -1.6, -1.45);
    const extrudeSettings = { depth: 0.06, bevelEnabled: true, bevelSegments: 5, steps: 1, bevelSize: 0.015, bevelThickness: 0.015 };
    const baseGeo = new THREE.ExtrudeGeometry(baseShape, extrudeSettings);
    baseGeo.center();
    const structuralBase = new THREE.Mesh(baseGeo, structuralMat);
    structuralBase.position.set(0, -1.38, 0);
    structuralBase.castShadow = true;
    logoGroup.add(structuralBase);

    function createSleekStick(startX, startY, endX, endY, thickness = 0.012) {
      const dx = endX - startX, dy = endY - startY;
      const distance = Math.sqrt(dx*dx + dy*dy);
      const geometry = new THREE.CylinderGeometry(thickness, thickness, distance, 20);
      geometry.translate(0, distance/2, 0);
      const mesh = new THREE.Mesh(geometry, structuralMat);
      mesh.position.set(startX, startY, 0);
      mesh.rotation.z = -Math.atan2(dx, dy);
      mesh.castShadow = true;
      return mesh;
    }

    const junctionY = -0.65, baseTopY = -1.36;
    logoGroup.add(createSleekStick(0, baseTopY, 0, junctionY, 0.016));
    logoGroup.add(createSleekStick(0, junctionY, 0, 0.1));
    logoGroup.add(createSleekStick(0, junctionY, -0.24, -0.45));
    logoGroup.add(createSleekStick(0, junctionY, 0.24, -0.45));
    logoGroup.add(createSleekStick(0, junctionY, -1.02, -0.32));
    logoGroup.add(createSleekStick(0, junctionY, 1.05, -0.32));

    const sphereGeo = new THREE.SphereGeometry(1, 64, 64);
    const glassNodesData = [
      { color: 0x009e3d, size: 0.88, x: 0,     y: 0.62,  z: -0.2  },
      { color: 0xd31111, size: 0.54, x: -0.92,  y: 0.28,  z: 0.1   },
      { color: 0x00b050, size: 0.48, x: -1.38,  y: -0.22, z: 0.2   },
      { color: 0x009688, size: 0.48, x: -0.62,  y: -0.38, z: 0.3   },
      { color: 0xa4cc00, size: 0.46, x: 0.48,   y: -0.42, z: 0.1   },
      { color: 0x0091ea, size: 0.45, x: 1.28,   y: -0.24, z: 0.2   },
      { color: 0x3f51b5, size: 0.52, x: 0.78,   y: 0.32,  z: 0.15  },
      { color: 0x0d47a1, size: 0.44, x: 0.90,   y: -0.08, z: 0.3   }
    ];
    glassNodesData.sort((a, b) => a.z - b.z);
    glassNodesData.forEach((data, index) => {
      const mesh = new THREE.Mesh(sphereGeo, createDarkenedPremiumGlassMaterial(data.color));
      mesh.scale.set(data.size, data.size, data.size * 0.45);
      mesh.position.set(data.x, data.y, data.z);
      mesh.castShadow = true;
      mesh.renderOrder = index;
      mesh.userData = {
        isBall: true, baseScale: { x: data.size, y: data.size, z: data.size * 0.45 },
        isAnimating: false, animTime: 0, clickCount: 0,
        isBlasting: false, blastTime: 0, shards: []
      };
      logoGroup.add(mesh);
    });
    return logoGroup;
  }

  const heroContainer = document.getElementById('hero-canvas-container');
  const sceneHero = new THREE.Scene();
  const cameraHero = new THREE.PerspectiveCamera(35, heroContainer.clientWidth / heroContainer.clientHeight, 0.1, 1000);
  cameraHero.position.set(0, 0, 5.8);
  const rendererHero = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  rendererHero.setSize(heroContainer.clientWidth, heroContainer.clientHeight);
  rendererHero.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  rendererHero.shadowMap.enabled = true;
  rendererHero.shadowMap.type = THREE.PCFSoftShadowMap;
  heroContainer.appendChild(rendererHero.domElement);

  function updateHeroCameraAndSize() {
  if (heroContainer.clientWidth === 0) return;
  const width = heroContainer.clientWidth;
  const height = heroContainer.clientHeight;
  const aspect = width / height;
  rendererHero.setSize(width, height);
  cameraHero.aspect = aspect;
  const designAspect = 1.3;
  cameraHero.fov = aspect < designAspect ? 35 * (designAspect / aspect) : 35;
  cameraHero.updateProjectionMatrix();
}
updateHeroCameraAndSize();

  sceneHero.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dirKey = new THREE.DirectionalLight(0xffffff, 1.4);
  dirKey.position.set(5, 8, 4); dirKey.castShadow = true;
  dirKey.shadow.mapSize.width = dirKey.shadow.mapSize.height = 2048;
  dirKey.shadow.camera.near = 0.5; dirKey.shadow.camera.far = 12;
  dirKey.shadow.camera.left = dirKey.shadow.camera.bottom = -2.5;
  dirKey.shadow.camera.right = dirKey.shadow.camera.top = 2.5;
  dirKey.shadow.bias = -0.0002;
  sceneHero.add(dirKey);
  const rimCyan = new THREE.PointLight(0x0091ea, 1.2, 12);
  rimCyan.position.set(-4, -1, 3); sceneHero.add(rimCyan);
  const rimEmerald = new THREE.PointLight(0x00c853, 1.0, 10);
  rimEmerald.position.set(4, 5, 2); sceneHero.add(rimEmerald);

  const interactiveLogoSystem = buildAestheticLogoTree();
  interactiveLogoSystem.scale.set(0.8, 0.8, 0.8);
  interactiveLogoSystem.position.set(-0.32, 0.1, 0);
  sceneHero.add(interactiveLogoSystem);

  const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(16,16), new THREE.ShadowMaterial({ opacity: 0.08 }));
  shadowPlane.rotation.x = -Math.PI/2; shadowPlane.position.set(-0.32, -1.35, 0);
  shadowPlane.receiveShadow = true; sceneHero.add(shadowPlane);

  const staticLogoContainer = document.getElementById('inline-static-logo');
  const sceneStatic = new THREE.Scene();
  const staticRect = staticLogoContainer.getBoundingClientRect();
  const cameraStatic = new THREE.PerspectiveCamera(42, staticRect.width / staticRect.height, 0.1, 100);
  cameraStatic.position.set(0, -0.15, 4.2);
  const rendererStatic = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  rendererStatic.setSize(staticRect.width, staticRect.height);
  rendererStatic.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  staticLogoContainer.appendChild(rendererStatic.domElement);
  sceneStatic.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dirStatic = new THREE.DirectionalLight(0xffffff, 1.5);
  dirStatic.position.set(2, 6, 4); sceneStatic.add(dirStatic);
  const staticLogoSystem = buildAestheticLogoTree();
  staticLogoSystem.scale.set(0.98, 0.98, 0.98);
  sceneStatic.add(staticLogoSystem);
  rendererStatic.render(sceneStatic, cameraStatic);

  let trackPointerX = 0, trackPointerY = 0;
  const screenMidW = window.innerWidth/2, screenMidH = window.innerHeight/2;
  document.addEventListener('mousemove', e => {
    trackPointerX = e.clientX - screenMidW;
    trackPointerY = e.clientY - screenMidH;
  });

  const timeClock = new THREE.Clock();
  let internalRotationTargetX = 0, internalRotationTargetY = 0;

  function executionLifecycleFrame() {
    requestAnimationFrame(executionLifecycleFrame);
    const elapsed = timeClock.getElapsedTime();
    interactiveLogoSystem.position.y = 0.1 + Math.sin(elapsed * 1.1) * 0.035;
    internalRotationTargetX = trackPointerY * 0.001;
    internalRotationTargetY = trackPointerX * 0.001;
    interactiveLogoSystem.rotation.y += (internalRotationTargetY - interactiveLogoSystem.rotation.y) * 0.12;
    interactiveLogoSystem.rotation.x += (internalRotationTargetX - interactiveLogoSystem.rotation.x) * 0.12;
    rendererHero.render(sceneHero, cameraHero);

    interactiveLogoSystem.children.forEach(child => {
      if (!child.userData) return;
      if (child.userData.isAnimating) {
        child.userData.animTime += 0.016;
        const t = child.userData.animTime;
        if (t > 1.2) {
          child.userData.isAnimating = false;
          child.scale.set(child.userData.baseScale.x, child.userData.baseScale.y, child.userData.baseScale.z);
        } else {
          const w = Math.sin(t*22) * Math.exp(-t*4.5) * 0.45;
          child.scale.y = child.userData.baseScale.y * (1+w);
          child.scale.x = child.userData.baseScale.x * (1-w*0.5);
          child.scale.z = child.userData.baseScale.z * (1-w*0.5);
        }
      }
      if (child.userData.isBlasting) {
        child.userData.blastTime += 0.016;
        const t = child.userData.blastTime;
        if (t >= 1.0) {
          child.userData.isBlasting = false; child.visible = true;
          child.userData.shards.forEach(s => { interactiveLogoSystem.remove(s); s.geometry.dispose(); });
          child.userData.shards = [];
        } else {
          const spread = Math.sin(t * Math.PI) * 1.6;
          child.userData.shards.forEach(s => {
            s.position.copy(child.position).addScaledVector(s.userData.dir, spread);
            s.rotation.x += s.userData.rotSpeed.x * 0.016;
            s.rotation.y += s.userData.rotSpeed.y * 0.016;
          });
        }
      }
      if (child.userData.isBall && !child.userData.isBlasting) {
        if (!child.userData.basePosition) child.userData.basePosition = child.position.clone();
        const seed = child.userData.basePosition.x * 3.5 + child.userData.basePosition.y * 2.0;
        child.position.x = child.userData.basePosition.x + Math.sin(elapsed*1.4+seed)*0.025;
        child.position.y = child.userData.basePosition.y + Math.cos(elapsed*1.7+seed)*0.025;
        child.position.z = child.userData.basePosition.z + Math.sin(elapsed*1.1+seed)*0.015;
      }
    });

    const hintEl = document.getElementById('click-hint');
    if (hintEl && hintEl.style.opacity !== '0') {
      const centerBall = interactiveLogoSystem.children.find(c => c.userData && c.userData.baseScale && c.userData.baseScale.x === 0.88);
      if (centerBall) {
        const wp = new THREE.Vector3();
        centerBall.getWorldPosition(wp); wp.project(cameraHero);
        hintEl.style.left = ((wp.x*0.5+0.5)*heroContainer.clientWidth - 28) + 'px';
        hintEl.style.top  = ((-wp.y*0.5+0.5)*heroContainer.clientHeight - 180) + 'px';
      }
    }
  }
  executionLifecycleFrame();

  const raycaster = new THREE.Raycaster();
  const mouseVector = new THREE.Vector2();
  heroContainer.addEventListener('pointerdown', event => {
    const rect = heroContainer.getBoundingClientRect();
    mouseVector.x =  ((event.clientX - rect.left) / rect.width)  * 2 - 1;
    mouseVector.y = -((event.clientY - rect.top)  / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouseVector, cameraHero);
    const hits = raycaster.intersectObjects(interactiveLogoSystem.children, true);
    if (!hits.length) return;
    const obj = hits[0].object;
    if (!obj.userData || !obj.userData.isBall || obj.userData.isBlasting) return;
    document.getElementById('click-hint').style.opacity = '0';
    obj.userData.clickCount++;
    if (obj.userData.clickCount >= 3) {
      obj.userData.isBlasting = true; obj.userData.blastTime = 0;
      obj.userData.isAnimating = false; obj.userData.clickCount = 0;
      obj.visible = false;
      const shardGeo = new THREE.TetrahedronGeometry(obj.userData.baseScale.x * 0.15);
      obj.userData.shards = [];
      for (let i = 0; i < 120; i++) {
        const sm = new THREE.Mesh(shardGeo, obj.material);
        sm.position.copy(obj.position);
        sm.userData = {
          dir: new THREE.Vector3((Math.random()-0.5)*2,(Math.random()-0.5)*2,(Math.random()-0.5)*2).normalize(),
          rotSpeed: new THREE.Vector3(Math.random()*8,Math.random()*8,Math.random()*8)
        };
        interactiveLogoSystem.add(sm); obj.userData.shards.push(sm);
      }
    } else {
      obj.userData.isAnimating = true; obj.userData.animTime = 0;
      clearTimeout(obj.userData.clickResetTimeout);
      obj.userData.clickResetTimeout = setTimeout(() => obj.userData.clickCount = 0, 1000);
    }
  });

  window.addEventListener('resize', () => {
updateHeroCameraAndSize();
    const r2 = staticLogoContainer.getBoundingClientRect();
    cameraStatic.aspect = r2.width/r2.height;
    cameraStatic.updateProjectionMatrix();
    rendererStatic.setSize(r2.width, r2.height);
    rendererStatic.render(sceneStatic, cameraStatic);
  });
})();
  `
}


// proceedForceLogin() {
//      this.showConflictModal.set(false)
//      this.auth.login(this.username.trim(), this.password.trim(), true).subscribe({
//        next: (r: any) => {
//          if (r?.status && !r.data.alreadyLoggedIn) {
//            this.auth.saveSession(r.data.token, r.data.name, r.data.role, r.data.agentId)
//            this.router.navigate(['/'])
//          }
//        },
//        error: () => this.errorMsg.set('Server error. Please try again.')
//      })
//    }

cancelForceLogin() {
  this.showConflictModal.set(false)
  this.pendingLoginData = null
  this.conflictDevice   = ''
}

ngOnDestroy() {
  if (this.animFrameId) cancelAnimationFrame(this.animFrameId)
  if (this._injectedScript) this._injectedScript.remove()
}
}