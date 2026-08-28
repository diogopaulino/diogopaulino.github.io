var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/data/products.ts
var SPECS, PRODUCTS, PRODUCT_INDICATOR, NAV_ITEMS;
var init_products = __esm({
  "src/data/products.ts"() {
    "use strict";
    SPECS = [
      { icon: "battery", value: "12 hr", label: "Battery Life" },
      { icon: "latency", value: "1 ms", label: "Low Latency" }
    ];
    PRODUCTS = [
      {
        id: "first-light",
        name: "007 First Light DualSense Wireless Controller",
        titleLines: ["007 FIRST", "LIGHT"],
        category: "PS5 CONTROLLER",
        description: "Style. Power. Precision. Make your mark and don't live tomorrow with the 007 First Light limited edition DualSense controller.",
        price: "$79.99",
        model: "/labs/ps5-controller/assets/models/first-light-controller.glb",
        photography: {
          front: "/labs/ps5-controller/assets/photography/first-light-front.webp",
          back: "/labs/ps5-controller/assets/photography/first-light-back.webp"
        },
        theme: {
          accent: "#e9cb92",
          accentStrong: "#f6e0b4",
          accentInk: "#1a1208",
          bgBase: "#080605",
          bgMid: "#1d1408",
          bgGlow: "#8f6323",
          glowIntensity: 1,
          groundGlow: "#d7a854",
          groundIntensity: 0.78,
          brushTint: "#d6b57c",
          brushOpacity: 0.24,
          keyLight: "#fffcf5",
          keyIntensity: 3.1,
          fillLight: "#9fb2c6",
          fillIntensity: 2.1,
          rimLight: "#ffeed6",
          rimIntensity: 3.2,
          envIntensity: 1.5,
          finish: [0.9, 1, 1.27]
        },
        specs: SPECS,
        promo: {
          title: "First Light",
          caption: "Behind the design",
          duration: "2:14"
        }
      },
      {
        id: "genshin-impact",
        name: "Genshin Impact DualSense Wireless Controller",
        titleLines: ["GENSHIN", "IMPACT"],
        category: "PS5 CONTROLLER",
        description: "Master elemental energy in Teyvat with an ethereal design, dual tone gradients inspired by iconic Lumine, Paimon and elemental arches.",
        price: "$79.99",
        model: "/labs/ps5-controller/assets/models/genshin-impact-controller.glb",
        photography: {
          front: "/labs/ps5-controller/assets/photography/genshin-impact-front.webp",
          back: "/labs/ps5-controller/assets/photography/genshin-impact-back.webp"
        },
        theme: {
          accent: "#7cd3f7",
          accentStrong: "#a6e4ff",
          accentInk: "#062031",
          bgBase: "#0a1526",
          bgMid: "#152b4a",
          bgGlow: "#3f7fb8",
          glowIntensity: 0.95,
          groundGlow: "#8fdcff",
          groundIntensity: 0.85,
          brushTint: "#a9d8f5",
          brushOpacity: 0.34,
          keyLight: "#fbfeff",
          keyIntensity: 2.2,
          // Warm, unlike the others. A cool fill on a product that is already white
          // and teal leaves nothing to separate its materials from each other; a
          // warm one puts the shadow side on the opposite side of neutral from the
          // key and the teal reads as teal again.
          fillLight: "#b3a696",
          fillIntensity: 1.5,
          rimLight: "#b6e9ff",
          rimIntensity: 2.6,
          envIntensity: 1
        },
        specs: SPECS,
        promo: {
          title: "Genshin Impact",
          caption: "Elemental edition",
          duration: "1:48"
        }
      },
      {
        id: "god-of-war",
        name: "God of War DualSense Wireless Controller",
        titleLines: ["GOD OF", "WAR"],
        category: "PS5 CONTROLLER",
        description: "Unleash your Spartan Rage with the God of War PS5 controller, inspired by Kratos' iconic blades and his relentless journey.",
        price: "$79.99",
        model: "/labs/ps5-controller/assets/models/god-of-war-controller.glb",
        photography: {
          front: "/labs/ps5-controller/assets/photography/god-of-war-front.webp",
          back: "/labs/ps5-controller/assets/photography/god-of-war-back.webp"
        },
        theme: {
          accent: "#f6f1ee",
          accentStrong: "#ffffff",
          accentInk: "#1a0d0c",
          bgBase: "#0e0807",
          bgMid: "#2b1513",
          bgGlow: "#6b342b",
          glowIntensity: 0.92,
          groundGlow: "#e6d3cd",
          groundIntensity: 0.7,
          brushTint: "#c99a8e",
          brushOpacity: 0.22,
          keyLight: "#fffaf7",
          keyIntensity: 2.02,
          fillLight: "#9aa8bb",
          fillIntensity: 1.42,
          rimLight: "#ffe2d6",
          rimIntensity: 2.5,
          envIntensity: 0.94
        },
        specs: SPECS,
        promo: {
          title: "God of War",
          caption: "Forged for Kratos",
          duration: "2:36"
        }
      }
    ];
    PRODUCT_INDICATOR = "PS5";
    NAV_ITEMS = [
      { label: "Games", href: "#games" },
      { label: "Accessories", href: "#accessories" },
      { label: "News", href: "#news" },
      { label: "Store", href: "#store" },
      { label: "Support", href: "#support" }
    ];
  }
});

// src/core/motion.ts
import gsap from "gsap";
function prefersReducedMotion() {
  return reduced;
}
function dur(seconds) {
  return reduced ? 1e-3 : seconds;
}
function damp(lambda, delta) {
  return 1 - Math.exp(-lambda * delta);
}
var MOTION, query, reduced;
var init_motion = __esm({
  "src/core/motion.ts"() {
    "use strict";
    MOTION = {
      ease: "power3.out",
      easeIn: "power2.in",
      easeInOut: "power2.inOut",
      easeExpo: "expo.out",
      /** A complete turn, in radians, split half to each product. */
      turn: Math.PI * 2,
      /** Depth the turn breathes back through at the swap, in world units. */
      depth: -0.35,
      /** How long each half of the revolution takes, in seconds. */
      half: 0.46,
      /** Length of the atmosphere and lighting crossfade. */
      crossfade: 1.05,
      /** Length of the shader light-sweep that carries the change. */
      sweep: 1.05
    };
    query = typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    reduced = query?.matches ?? false;
    query?.addEventListener("change", (event) => {
      reduced = event.matches;
      gsap.globalTimeline.timeScale(reduced ? 100 : 1);
    });
  }
});

// src/three/Background.ts
import { Color, Vector2 } from "three/webgpu";
import {
  Fn,
  dot,
  float,
  fract,
  mix,
  oneMinus,
  screenUV,
  sin,
  smoothstep,
  texture,
  time,
  uniform,
  vec2,
  vec4
} from "three/tsl";
var Background;
var init_Background = __esm({
  "src/three/Background.ts"() {
    "use strict";
    Background = class {
      uBase = uniform(new Color("#0a0705"));
      uMid = uniform(new Color("#2a1c09"));
      uGlow = uniform(new Color("#8a5f20"));
      uGlowIntensity = uniform(1);
      uBrushTint = uniform(new Color("#d6b57c"));
      uBrushOpacity = uniform(0.12);
      /** Glow centre in screen UV — matches the product's optical centre. */
      uCenter = uniform(new Vector2(0.492, 0.514));
      uAspect = uniform(1.6);
      /** Pointer parallax offset, kept tiny so the light merely breathes. */
      uParallax = uniform(new Vector2(0, 0));
      /** Radius of the expanding ring driven during a product change. */
      uSweep = uniform(0);
      uSweepStrength = uniform(0);
      /** Intro reveal — 0 while the first model is still loading. */
      uReveal = uniform(0);
      node;
      constructor(brushMap) {
        const brush = brushMap ? texture(brushMap) : null;
        this.node = Fn(() => {
          const centre = this.uCenter.add(this.uParallax);
          const offset = screenUV.sub(centre);
          const p = vec2(offset.x.mul(this.uAspect).mul(0.86), offset.y.mul(1.24));
          const r = p.length();
          const body = mix(this.uMid, this.uBase, smoothstep(0.06, 0.62, r));
          const brushed = brush ? (() => {
            const widthScale = this.uAspect.div(1.6).max(1).mul(1.04);
            const bUv = screenUV.sub(centre).mul(vec2(float(1).div(widthScale), float(1).div(0.68))).add(vec2(0.5, 0.5));
            const inside = smoothstep(0, 0.015, bUv.x).mul(oneMinus(smoothstep(0.985, 1, bUv.x))).mul(smoothstep(0, 0.015, bUv.y)).mul(oneMinus(smoothstep(0.985, 1, bUv.y)));
            const visibility = smoothstep(0.04, 0.4, r).mul(oneMinus(smoothstep(0.42, 1.05, r)));
            const stroke2 = brush.sample(bUv).a.mul(inside).mul(visibility);
            return body.add(this.uBrushTint.mul(stroke2.mul(this.uBrushOpacity)));
          })() : body;
          const core = r.mul(r).mul(-13).exp().mul(0.46);
          const halo = r.mul(r).mul(-3).exp().mul(0.15);
          const drift = sin(time.mul(0.32)).mul(0.045).add(1);
          const glow = core.add(halo).mul(this.uGlowIntensity).mul(drift).mul(this.uReveal);
          const lit = brushed.add(this.uGlow.mul(glow));
          const ringR = r.sub(this.uSweep.mul(1.45)).div(0.24);
          const ring = ringR.mul(ringR).mul(-1).exp().mul(this.uSweepStrength).mul(0.9);
          const swept = lit.add(this.uGlow.mul(ring));
          const vignetted = swept.mul(mix(float(1), float(0.05), smoothstep(0.13, 0.88, r)));
          const seed = dot(screenUV, vec2(12.9898, 78.233));
          const grain = fract(sin(seed).mul(43758.5453)).sub(0.5).mul(0.014);
          return vec4(vignetted.add(grain), 1);
        })();
      }
      /** Colour targets for a product; tweened onto the shared timeline. */
      targets(theme) {
        return {
          base: new Color(theme.bgBase),
          mid: new Color(theme.bgMid),
          glow: new Color(theme.bgGlow),
          glowIntensity: theme.glowIntensity,
          brushTint: new Color(theme.brushTint),
          brushOpacity: theme.brushOpacity
        };
      }
      setAspect(width, height) {
        this.uAspect.value = width / height;
      }
    };
  }
});

// src/three/GroundGlow.ts
import {
  AdditiveBlending,
  Color as Color2,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  NormalBlending,
  PlaneGeometry
} from "three/webgpu";
import { Fn as Fn2, float as float2, mix as mix2, oneMinus as oneMinus2, smoothstep as smoothstep2, time as time2, uniform as uniform2, uv, vec2 as vec22, vec3 } from "three/tsl";
var GroundGlow;
var init_GroundGlow = __esm({
  "src/three/GroundGlow.ts"() {
    "use strict";
    GroundGlow = class {
      group = new Group();
      uColour = uniform2(new Color2("#d7a854"));
      uIntensity = uniform2(1);
      uReveal = uniform2(0);
      uContact = uniform2(1);
      glow;
      contact;
      constructor() {
        const plane = new PlaneGeometry(1, 1, 1, 1);
        const glowMaterial = new MeshBasicNodeMaterial({
          transparent: true,
          depthWrite: false,
          blending: AdditiveBlending,
          toneMapped: true
        });
        glowMaterial.colorNode = Fn2(() => {
          const p = uv().sub(0.5).mul(2);
          const d = p.length();
          const pool = oneMinus2(smoothstep2(0, 1, d)).pow(2.6).mul(0.07);
          const edge = d.sub(0.9).div(0.05);
          const contour = edge.mul(edge).mul(-1).exp().mul(0.22);
          const bleed = d.sub(0.9).div(0.26);
          const spill = bleed.mul(bleed).mul(-1).exp().mul(0.055);
          const depthBias = mix2(float2(1.25), float2(0.55), uv().y);
          const breathe = time2.mul(0.45).sin().mul(0.05).add(1);
          const strength = pool.add(contour).add(spill).mul(depthBias).mul(breathe).mul(this.uIntensity).mul(this.uReveal);
          return this.uColour.mul(strength);
        })();
        this.glow = new Mesh(plane, glowMaterial);
        this.glow.rotation.x = -Math.PI / 2;
        this.glow.scale.set(1.02, 0.44, 1);
        this.glow.position.y = 12e-4;
        this.glow.renderOrder = -1;
        const contactMaterial = new MeshBasicNodeMaterial({
          transparent: true,
          depthWrite: false,
          blending: NormalBlending,
          toneMapped: false
        });
        contactMaterial.colorNode = vec3(0, 0, 0);
        contactMaterial.opacityNode = Fn2(() => {
          const p = uv().sub(0.5).mul(2);
          const core = oneMinus2(smoothstep2(0.05, 1, p.length())).pow(1.9);
          const left = oneMinus2(smoothstep2(0, 1, p.sub(vec22(-0.52, 0.06)).length().mul(1.7)));
          const right = oneMinus2(smoothstep2(0, 1, p.sub(vec22(0.52, 0.06)).length().mul(1.7)));
          return core.mul(0.5).add(left.mul(0.28)).add(right.mul(0.28)).mul(this.uContact).mul(this.uReveal).clamp(0, 0.82);
        })();
        this.contact = new Mesh(plane, contactMaterial);
        this.contact.rotation.x = -Math.PI / 2;
        this.contact.scale.set(0.94, 0.34, 1);
        this.contact.position.y = 6e-4;
        this.contact.renderOrder = -2;
        this.group.add(this.contact, this.glow);
      }
      targets(theme) {
        return {
          colour: new Color2(theme.groundGlow),
          intensity: theme.groundIntensity
        };
      }
      dispose() {
        this.glow.geometry.dispose();
        this.glow.material.dispose();
        this.contact.material.dispose();
      }
    };
  }
});

// src/three/Lighting.ts
import { Color as Color3, DirectionalLight, Group as Group2, HemisphereLight, PointLight } from "three/webgpu";
var Lighting;
var init_Lighting = __esm({
  "src/three/Lighting.ts"() {
    "use strict";
    Lighting = class {
      group = new Group2();
      key = new DirectionalLight("#ffe9c4", 3.1);
      fill = new DirectionalLight("#7d5f38", 1.15);
      rimLeft = new DirectionalLight("#ffd89a", 1.7);
      rimRight = new DirectionalLight("#ffd89a", 1.7);
      bounce = new PointLight("#d7a854", 1.5, 6, 2);
      ambient = new HemisphereLight("#39414c", "#0a0908", 0.62);
      constructor() {
        this.key.position.set(-1.9, 3.1, 2.6);
        this.fill.position.set(2.6, 0.9, 2.2);
        this.rimLeft.position.set(-3.1, 1.4, -2.2);
        this.rimRight.position.set(3.1, 1.5, -2);
        this.bounce.position.set(0, 0.08, 0.62);
        this.group.add(
          this.key,
          this.fill,
          this.rimLeft,
          this.rimRight,
          this.bounce,
          this.ambient
        );
      }
      /** Colour/intensity targets for a product, consumed by the transition tween. */
      targets(theme) {
        return {
          key: new Color3(theme.keyLight),
          keyIntensity: theme.keyIntensity,
          fill: new Color3(theme.fillLight),
          fillIntensity: theme.fillIntensity,
          rim: new Color3(theme.rimLight),
          rimIntensity: theme.rimIntensity,
          bounce: new Color3(theme.groundGlow)
        };
      }
      apply(theme) {
        const t = this.targets(theme);
        this.key.color.copy(t.key);
        this.key.intensity = t.keyIntensity;
        this.fill.color.copy(t.fill);
        this.fill.intensity = t.fillIntensity;
        this.rimLeft.color.copy(t.rim);
        this.rimRight.color.copy(t.rim);
        this.rimLeft.intensity = t.rimIntensity;
        this.rimRight.intensity = t.rimIntensity * 0.85;
        this.bounce.color.copy(t.bounce);
      }
    };
  }
});

// src/three/ProductModel.ts
import {
  Box3,
  Group as Group3,
  LinearSRGBColorSpace,
  Mesh as Mesh2,
  MeshBasicNodeMaterial as MeshBasicNodeMaterial2,
  Vector3
} from "three/webgpu";
var DEPTH_ONLY, HERO_YAW, HERO_YAW_OFFSET, ProductModel;
var init_ProductModel = __esm({
  "src/three/ProductModel.ts"() {
    "use strict";
    DEPTH_ONLY = new MeshBasicNodeMaterial2();
    DEPTH_ONLY.colorWrite = false;
    DEPTH_ONLY.depthWrite = true;
    DEPTH_ONLY.depthTest = true;
    DEPTH_ONLY.transparent = false;
    DEPTH_ONLY.polygonOffset = true;
    DEPTH_ONLY.polygonOffsetFactor = 1;
    DEPTH_ONLY.polygonOffsetUnits = 4;
    HERO_YAW = 0;
    HERO_YAW_OFFSET = 0;
    ProductModel = class {
      constructor(root2) {
        this.root = root2;
        const box = new Box3().setFromObject(root2);
        box.getSize(this.size);
        const centre = box.getCenter(new Vector3());
        this.centreY = centre.y;
        this.centreOffset.set(-centre.x, -centre.y, -centre.z);
        this.inner.position.copy(this.centreOffset);
        this.inner.add(root2);
        this.group.position.set(0, centre.y, 0);
        this.group.rotation.y = HERO_YAW + HERO_YAW_OFFSET;
        this.group.add(this.inner);
        const proxied = [];
        root2.traverse((child) => {
          const mesh = child;
          if (!mesh.isMesh) return;
          const material = mesh.material;
          if (!material) return;
          this.materials.push(material);
          proxied.push({ mesh });
        });
        for (const { mesh } of proxied) {
          const proxy = new Mesh2(mesh.geometry, DEPTH_ONLY);
          proxy.name = `${mesh.name || "mesh"}__depth`;
          proxy.visible = false;
          proxy.renderOrder = -1;
          mesh.add(proxy);
          this.depthProxies.push(proxy);
        }
      }
      root;
      group = new Group3();
      inner = new Group3();
      materials = [];
      /**
       * Depth-only stand-ins, one per mesh, shown only while the product is fading.
       *
       * A blended solid has no idea it is solid: its triangles are drawn in whatever
       * order they sit in the buffer, so a far surface can be laid down first and a
       * near one blended over the top of it. The result is that you see *into* the
       * controller — its far shell and inner faces showing through the near shell as
       * transparent patches. Laying the silhouette into the depth buffer first, with
       * colour writes off, means only the frontmost surface survives the depth test
       * when the real pass runs, and the product dissolves as one skin.
       *
       * They stay hidden while the product is opaque, where they would be pure cost.
       */
      depthProxies = [];
      /** Height of the product's optical centre above the floor. */
      centreY;
      /** Translation that puts the product's optical centre on the origin. */
      centreOffset = new Vector3();
      /** Overall width of the product, used to frame the camera. */
      size = new Vector3();
      /** Rest pose the transition animates back to. */
      resetPose() {
        this.group.rotation.set(0, HERO_YAW + HERO_YAW_OFFSET, 0);
        this.group.position.set(0, this.centreY, 0);
        this.group.scale.setScalar(1);
      }
      setEnvIntensity(value) {
        for (const material of this.materials) material.envMapIntensity = value;
      }
      /**
       * Applies a linear multiplier to the base colour. Used to bring a scanned
       * finish in line with the product's real photography.
       */
      setFinish(finish) {
        for (const material of this.materials) {
          if (finish) material.color.setRGB(finish[0], finish[1], finish[2], LinearSRGBColorSpace);
          else material.color.setRGB(1, 1, 1, LinearSRGBColorSpace);
        }
      }
      /**
       * Fades the product.
       *
       * The materials are transparent from the start and stay that way, so opacity
       * itself is only a uniform update. What does change is who owns the depth
       * buffer: while fading, the pre-pass writes it and the blended pass merely
       * tests against it, which is what stops the product showing its own insides.
       *
       * A product at zero opacity is taken out of the scene entirely rather than
       * merely drawn as nothing. Its depth pre-pass is still a solid object as far
       * as the depth buffer is concerned, and an invisible controller waiting to
       * enter would otherwise stamp its own silhouette into the buffer and punch
       * that shape straight out of the one still on screen.
       */
      setOpacity(value) {
        const visible = value > 1e-3;
        this.group.visible = visible;
        for (const material of this.materials) material.opacity = value;
        this.setDepthMode(value < 0.999 && visible);
      }
      /**
       * Chooses which pass owns the depth buffer, independently of opacity.
       *
       * Opacity normally implies the answer, but the two are separable and the
       * pipeline warm-up needs them apart: it has to compile both depth states
       * without ever making the product visible.
       */
      setDepthMode(fading) {
        for (const material of this.materials) material.depthWrite = !fading;
        for (const proxy of this.depthProxies) proxy.visible = fading && this.group.visible;
      }
      /** Returns the product to full opacity once a fade has finished. */
      settle() {
        this.setOpacity(1);
      }
      dispose() {
        this.root.traverse((child) => {
          const mesh = child;
          if (!mesh.isMesh) return;
          mesh.geometry.dispose();
        });
        for (const proxy of this.depthProxies) proxy.removeFromParent();
        this.depthProxies.length = 0;
        for (const material of this.materials) {
          material.map?.dispose();
          material.normalMap?.dispose();
          material.roughnessMap?.dispose();
          material.metalnessMap?.dispose();
          material.dispose();
        }
        this.group.removeFromParent();
      }
    };
  }
});

// src/three/assets.ts
import {
  ClampToEdgeWrapping,
  DataTexture,
  EquirectangularReflectionMapping,
  FloatType,
  LinearFilter,
  LinearSRGBColorSpace as LinearSRGBColorSpace2,
  RGBAFormat,
  SRGBColorSpace,
  Texture
} from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
function getLoader() {
  if (!loader) {
    loader = new GLTFLoader();
    draco = new DRACOLoader();
    draco.setDecoderPath("/labs/ps5-controller/assets/draco/gltf/");
    draco.preload();
    loader.setDRACOLoader(draco);
    loader.setMeshoptDecoder(MeshoptDecoder);
  }
  return loader;
}
function loadModel(url, options = {}) {
  const cached = modelCache.get(url);
  if (cached) return cached;
  const promise = new Promise((resolve, reject) => {
    getLoader().load(
      url,
      (gltf) => resolve(prepare(gltf.scene, options.anisotropy ?? ANISOTROPY)),
      (event) => {
        if (options.onProgress && event.total) options.onProgress(event.loaded / event.total);
      },
      reject
    );
  });
  modelCache.set(url, promise);
  return promise;
}
function prepare(root2, anisotropy) {
  root2.traverse((child) => {
    const mesh = child;
    if (!mesh.isMesh) return;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    const material = mesh.material;
    if (!material) return;
    for (const map of [
      material.map,
      material.normalMap,
      material.roughnessMap,
      material.metalnessMap
    ]) {
      if (!map) continue;
      map.anisotropy = anisotropy;
      map.needsUpdate = true;
    }
    material.envMapIntensity = 1;
    material.roughness = Math.min(1, material.roughness ?? 1);
    material.metalness = material.metalness ?? 1;
    material.normalScale?.set(1.15, 1.15);
    material.transparent = true;
    material.depthWrite = true;
    material.opacity = 1;
    material.needsUpdate = true;
  });
  return root2;
}
function createStudioEnvironment(width = 512) {
  const height = width / 2;
  const data = new Float32Array(width * height * 4);
  const panel = (dPhi, dEl, halfWidth, halfHeight, softness) => {
    const x = 1 - smoothstep3(halfWidth - softness, halfWidth, Math.abs(dPhi));
    const y = 1 - smoothstep3(halfHeight - softness, halfHeight, Math.abs(dEl));
    return x * y;
  };
  const lobes = [
    // Key softbox, high and to the left — the light that shapes the product.
    // Neutral rather than warm: the finishes here are already strongly coloured
    // and a warm key pushes the gold past where the real product sits.
    {
      azimuth: -0.9,
      elevation: 0.85,
      halfWidth: 0.62,
      halfHeight: 0.5,
      softness: 0.42,
      colour: [5.5, 5.45, 5.35]
    },
    // Cool fill on the right — wide, soft and a real presence rather than a
    // token one. It is what keeps the shadow side from going dead, and its
    // coolness is what stops a saturated finish reading as a single flat hue.
    {
      azimuth: 1.35,
      elevation: 0.28,
      halfWidth: 1.05,
      halfHeight: 0.72,
      softness: 0.75,
      colour: [1.15, 1.4, 1.85]
    },
    // Narrow strip behind, which is what draws the silhouette.
    {
      azimuth: Math.PI,
      elevation: 0.16,
      halfWidth: 1.15,
      halfHeight: 0.11,
      softness: 0.16,
      colour: [3.1, 3, 2.85]
    },
    // Small hard source for a specular glint the softboxes cannot give.
    {
      azimuth: -0.35,
      elevation: 1.15,
      halfWidth: 0.1,
      halfHeight: 0.08,
      softness: 0.05,
      colour: [11, 10.6, 10]
    },
    // Broad, dim bounce off the floor. Without it every downward-facing surface
    // has nothing to reflect and the undersides of the grips crush to black,
    // which reads as the product fading out at the bottom rather than sitting
    // on something.
    {
      azimuth: 0,
      elevation: -1.05,
      halfWidth: 3.2,
      halfHeight: 0.62,
      softness: 0.55,
      colour: [0.42, 0.41, 0.4]
    }
  ];
  for (let y = 0; y < height; y++) {
    const theta = y / (height - 1) * Math.PI;
    const elevation = Math.PI / 2 - theta;
    for (let x = 0; x < width; x++) {
      const phi = x / width * Math.PI * 2 - Math.PI;
      const up = Math.max(0, Math.sin(elevation));
      let r = 0.014 + up * 0.07;
      let g = 0.015 + up * 0.072;
      let b = 0.018 + up * 0.085;
      const horizon = Math.exp(-Math.pow(elevation / 0.26, 2)) * 0.045;
      r += horizon;
      g += horizon;
      b += horizon * 1.12;
      for (const lobe of lobes) {
        let dPhi = phi - lobe.azimuth;
        while (dPhi > Math.PI) dPhi -= Math.PI * 2;
        while (dPhi < -Math.PI) dPhi += Math.PI * 2;
        const amount = panel(
          dPhi,
          elevation - lobe.elevation,
          lobe.halfWidth,
          lobe.halfHeight,
          lobe.softness
        );
        if (amount <= 0) continue;
        r += lobe.colour[0] * amount;
        g += lobe.colour[1] * amount;
        b += lobe.colour[2] * amount;
      }
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 1;
    }
  }
  const texture2 = new DataTexture(data, width, height, RGBAFormat, FloatType);
  texture2.mapping = EquirectangularReflectionMapping;
  texture2.colorSpace = LinearSRGBColorSpace2;
  texture2.minFilter = LinearFilter;
  texture2.magFilter = LinearFilter;
  texture2.needsUpdate = true;
  return texture2;
}
function smoothstep3(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0 || 1)));
  return t * t * (3 - 2 * t);
}
async function loadBrushTexture(url, width = 1536) {
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  await image.decode();
  const height = Math.round(width * image.naturalHeight / image.naturalWidth) || width / 2;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");
  ctx.drawImage(image, 0, 0, width, height);
  const texture2 = new Texture(canvas);
  texture2.colorSpace = SRGBColorSpace;
  texture2.wrapS = ClampToEdgeWrapping;
  texture2.wrapT = ClampToEdgeWrapping;
  texture2.minFilter = LinearFilter;
  texture2.magFilter = LinearFilter;
  texture2.generateMipmaps = false;
  texture2.needsUpdate = true;
  return texture2;
}
var loader, draco, modelCache, ANISOTROPY;
var init_assets = __esm({
  "src/three/assets.ts"() {
    "use strict";
    loader = null;
    draco = null;
    modelCache = /* @__PURE__ */ new Map();
    ANISOTROPY = 16;
  }
});

// src/three/Thumbnails.ts
import {
  Group as Group4,
  MathUtils,
  PerspectiveCamera,
  RenderTarget,
  SRGBColorSpace as SRGBColorSpace2,
  Scene
} from "three/webgpu";
function toDataURL(pixels, size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const image = ctx.createImageData(size, size);
  image.data.set(new Uint8ClampedArray(pixels.buffer, pixels.byteOffset, size * size * 4));
  ctx.putImageData(image, 0, 0);
  const bounds = opaqueBounds(image.data, size);
  if (!bounds) return canvas.toDataURL("image/webp", 0.92);
  const out = document.createElement("canvas");
  out.width = bounds.w;
  out.height = bounds.h;
  const outCtx = out.getContext("2d");
  if (!outCtx) return canvas.toDataURL("image/webp", 0.92);
  outCtx.drawImage(canvas, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, bounds.w, bounds.h);
  return out.toDataURL("image/webp", 0.92);
}
function opaqueBounds(data, size) {
  let minX = size;
  let minY = size;
  let maxX = -1;
  let maxY = -1;
  for (let y2 = 0; y2 < size; y2++) {
    for (let x2 = 0; x2 < size; x2++) {
      if (data[(y2 * size + x2) * 4 + 3] > 12) {
        if (x2 < minX) minX = x2;
        if (x2 > maxX) maxX = x2;
        if (y2 < minY) minY = y2;
        if (y2 > maxY) maxY = y2;
      }
    }
  }
  if (maxX < 0) return null;
  const pad = 6;
  const x = Math.max(0, minX - pad);
  const y = Math.max(0, minY - pad);
  return {
    x,
    y,
    w: Math.min(size - x, maxX - minX + pad * 2),
    h: Math.min(size - y, maxY - minY + pad * 2)
  };
}
var SIZE, POSES, ThumbnailStudio;
var init_Thumbnails = __esm({
  "src/three/Thumbnails.ts"() {
    "use strict";
    init_Lighting();
    init_ProductModel();
    SIZE = 512;
    POSES = {
      front: { yaw: 0.1, pitch: 9, fill: 0.74 },
      angled: { yaw: -0.55, pitch: 13, fill: 0.68 }
    };
    ThumbnailStudio = class {
      constructor(renderer, environment) {
        this.renderer = renderer;
        this.scene.environment = environment;
        this.scene.environmentIntensity = 1.1;
        this.scene.add(this.rig, this.lighting.group);
        this.target = new RenderTarget(SIZE, SIZE, { depthBuffer: true, samples: 4 });
        this.target.texture.colorSpace = SRGBColorSpace2;
      }
      renderer;
      scene = new Scene();
      camera = new PerspectiveCamera(24, 1, 0.05, 40);
      rig = new Group4();
      lighting = new Lighting();
      target;
      cache = /* @__PURE__ */ new Map();
      queue = Promise.resolve();
      async capture(model, product, pose) {
        const key = `${product.id}:${pose}`;
        const cached = this.cache.get(key);
        if (cached) return cached;
        const run = this.queue.then(() => this.render(model, product, pose));
        this.queue = run.catch(() => void 0);
        const result = await run;
        if (result) this.cache.set(key, result);
        return result;
      }
      async render(model, product, pose) {
        const { yaw, pitch, fill } = POSES[pose];
        const stand_in = model.root.clone(true);
        stand_in.position.copy(model.centreOffset);
        try {
          this.lighting.apply(product.theme);
          this.lighting.key.intensity = product.theme.keyIntensity * 1.05;
          this.lighting.ambient.intensity = 0.75;
          this.scene.environmentIntensity = product.theme.envIntensity;
          this.rig.rotation.set(0, HERO_YAW + yaw, 0);
          this.rig.add(stand_in);
          const halfFov = MathUtils.degToRad(this.camera.fov) / 2;
          const distance = model.size.y / fill / 2 / Math.tan(halfFov);
          const el2 = MathUtils.degToRad(pitch);
          this.camera.position.set(0, Math.sin(el2) * distance, Math.cos(el2) * distance);
          this.camera.lookAt(0, 0, 0);
          this.camera.updateProjectionMatrix();
          const previousTarget = this.renderer.getRenderTarget();
          const previousAlpha = this.renderer.getClearAlpha();
          this.renderer.setRenderTarget(this.target);
          this.renderer.setClearAlpha(0);
          await this.renderer.clearAsync();
          await this.renderer.renderAsync(this.scene, this.camera);
          const pixels = await this.renderer.readRenderTargetPixelsAsync(
            this.target,
            0,
            0,
            SIZE,
            SIZE
          );
          this.renderer.setRenderTarget(previousTarget);
          this.renderer.setClearAlpha(previousAlpha);
          return toDataURL(pixels, SIZE);
        } catch {
          return null;
        } finally {
          this.rig.clear();
        }
      }
      dispose() {
        this.target.dispose();
        this.cache.clear();
      }
    };
  }
});

// src/three/ProductScene.ts
var ProductScene_exports = {};
__export(ProductScene_exports, {
  ProductScene: () => ProductScene
});
import {
  Group as Group5,
  MathUtils as MathUtils2,
  NeutralToneMapping,
  PMREMGenerator,
  PerspectiveCamera as PerspectiveCamera2,
  RenderPipeline,
  Scene as Scene2,
  Vector2 as Vector22,
  WebGPURenderer
} from "three/webgpu";
import { pass } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import gsap6 from "gsap";
function rgb(colour) {
  return { r: colour.r, g: colour.g, b: colour.b };
}
var TAU, WARM_PARK, BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD, DRAG_YAW, DRAG_PITCH, PITCH_LIMIT, SETTLE_DELAY, MAX_THROW_YAW, MAX_THROW_PITCH, THROW_DECAY, FRAMING, ProductScene;
var init_ProductScene = __esm({
  "src/three/ProductScene.ts"() {
    "use strict";
    init_products();
    init_motion();
    init_Background();
    init_GroundGlow();
    init_Lighting();
    init_ProductModel();
    init_assets();
    init_Thumbnails();
    TAU = Math.PI * 2;
    WARM_PARK = 40;
    BLOOM_STRENGTH = 0.28;
    BLOOM_RADIUS = 0.72;
    BLOOM_THRESHOLD = 0.86;
    DRAG_YAW = 72e-4;
    DRAG_PITCH = 38e-4;
    PITCH_LIMIT = 0.38;
    SETTLE_DELAY = 2.6;
    MAX_THROW_YAW = 2.8;
    MAX_THROW_PITCH = 1.4;
    THROW_DECAY = 4.6;
    FRAMING = {
      desktop: { fill: 0.415, centreY: 0.476, centreX: 0.492, elevation: 9, fov: 26 },
      tablet: { fill: 0.3, centreY: 0.44, centreX: 0.5, elevation: 8, fov: 28 },
      mobile: { fill: 0.235, centreY: 0.435, centreX: 0.5, elevation: 7, fov: 30 }
    };
    ProductScene = class {
      scene = new Scene2();
      camera = new PerspectiveCamera2(26, 1, 0.1, 60);
      renderer;
      canvas;
      background;
      ground = new GroundGlow();
      lighting = new Lighting();
      stage = new Group5();
      thumbnails = null;
      /**
       * Bloom pass. Only the specular highlights clear the threshold, so what it
       * adds is the halo a bright edge throws in a real lens — the thing that
       * separates a product photograph from a flat render. Optional by design: if
       * the pass cannot be built the scene renders directly and looks a little
       * plainer.
       */
      post = null;
      models = /* @__PURE__ */ new Map();
      current = null;
      environment = null;
      pointer = new Vector22(0, 0);
      pointerTarget = new Vector22(0, 0);
      parallax = new Vector22(0, 0);
      /**
       * Direct manipulation of the product.
       *
       * `yaw` and `pitch` are the visitor's own offset from the hero pose; they are
       * composed with the idle drift and pointer parallax rather than replacing
       * them, so letting go returns the product to the same restrained motion it
       * had before. Releasing carries the throw's momentum, pitch always eases back
       * level, and after a pause the product drifts home to the nearest full turn —
       * the composition restores itself without ever snapping.
       */
      drag = {
        active: false,
        pointerId: -1,
        surface: null,
        lastX: 0,
        lastY: 0,
        lastMove: 0,
        yaw: 0,
        pitch: 0,
        velocityYaw: 0,
        velocityPitch: 0,
        releasedAt: 0
      };
      idleTime = 0;
      running = false;
      lastTime = 0;
      scrollFade = 1;
      transitioning = false;
      disposed = false;
      maxAnisotropy = 16;
      width = 1;
      height = 1;
      framing = FRAMING.desktop;
      bandOverride = null;
      /** Resolves once the renderer, environment and first model are ready. */
      async init(container, onProgress) {
        const rendererOptions = {
          antialias: true,
          alpha: false,
          powerPreference: "high-performance"
        };
        const backends = navigator.gpu ? [false, true] : [true];
        let lastError = null;
        for (const forceWebGL of backends) {
          try {
            this.renderer = new WebGPURenderer({ ...rendererOptions, forceWebGL });
            await this.renderer.init();
            lastError = null;
            break;
          } catch (error) {
            lastError = error;
            this.renderer?.dispose?.();
            this.renderer = void 0;
          }
        }
        if (!this.renderer) throw lastError ?? new Error("Renderer unavailable");
        const capabilities = this.renderer;
        this.maxAnisotropy = Math.min(16, capabilities.getMaxAnisotropy?.() ?? 16);
        this.renderer.toneMapping = NeutralToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.renderer.setClearColor(328707, 1);
        const backend = this.renderer.backend;
        const diag = window;
        diag.__backend = backend?.isWebGPUBackend ? "webgpu" : "webgl2";
        diag.__scene = this;
        this.canvas = this.renderer.domElement;
        this.canvas.className = "stage__canvas";
        this.canvas.setAttribute("aria-hidden", "true");
        container.appendChild(this.canvas);
        onProgress?.(0.08);
        const pmrem = new PMREMGenerator(this.renderer);
        const studio = createStudioEnvironment(256);
        this.environment = pmrem.fromEquirectangular(studio).texture;
        studio.dispose();
        pmrem.dispose();
        this.scene.environment = this.environment;
        this.scene.environmentIntensity = PRODUCTS[0].theme.envIntensity;
        onProgress?.(0.16);
        let brush = null;
        try {
          brush = await loadBrushTexture("/labs/ps5-controller/assets/brush/brush-strokes.svg");
        } catch {
          brush = null;
        }
        this.background = new Background(brush);
        this.scene.backgroundNode = this.background.node;
        this.scene.add(this.stage, this.ground.group, this.lighting.group);
        this.lighting.apply(PRODUCTS[0].theme);
        this.applyTheme(PRODUCTS[0], true);
        onProgress?.(0.24);
        this.resize();
        this.bindEvents();
        this.thumbnails = new ThumbnailStudio(this.renderer, this.environment);
        this.setupBloom();
        await this.ensureModel(PRODUCTS[0], (ratio) => onProgress?.(0.24 + ratio * 0.7));
        const first = this.models.get(PRODUCTS[0].id);
        first.resetPose();
        first.setEnvIntensity(PRODUCTS[0].theme.envIntensity);
        this.stage.add(first.group);
        this.current = first;
        onProgress?.(1);
        this.start();
      }
      /**
       * Builds the bloom chain. Kept deliberately restrained — a high threshold so
       * only genuine highlights contribute, and a low strength so the product gains
       * a sheen rather than a glow.
       */
      setupBloom() {
        try {
          const scenePass = pass(this.scene, this.camera);
          const colour = scenePass.getTextureNode();
          const post = new RenderPipeline(this.renderer);
          post.outputNode = colour.add(bloom(colour, BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD));
          this.post = post;
        } catch (error) {
          console.warn("[showcase] bloom unavailable, rendering directly", error);
          this.post = null;
        }
      }
      /* ---------------------------------------------------------- lifecycle -- */
      bindEvents() {
        window.addEventListener("resize", this.onResize, { passive: true });
        window.addEventListener("pointermove", this.onPointerMove, { passive: true });
        document.addEventListener("visibilitychange", this.onVisibility);
        this.attachDragSurface(this.canvas);
      }
      /**
       * Makes an element turn the product when dragged.
       *
       * The canvas is registered automatically. On the scrolling layouts the
       * interface sits above it and does take the pointer, so the band reserved for
       * the product is registered too — a drag there turns the controller, while a
       * swipe anywhere else still changes campaign.
       */
      attachDragSurface(element) {
        element.addEventListener("pointerdown", this.onDragStart);
        element.addEventListener("pointermove", this.onDragMove);
        element.addEventListener("pointerup", this.onDragEnd);
        element.addEventListener("pointercancel", this.onDragEnd);
        element.style.touchAction = "pan-y";
        element.style.cursor = "grab";
      }
      /* ------------------------------------------------------ direct control -- */
      onDragStart = (event) => {
        if (this.drag.active || event.button !== 0) return;
        const surface = event.currentTarget;
        this.drag.active = true;
        this.drag.pointerId = event.pointerId;
        this.drag.surface = surface;
        this.drag.lastX = event.clientX;
        this.drag.lastY = event.clientY;
        this.drag.lastMove = performance.now();
        this.drag.velocityYaw = 0;
        this.drag.velocityPitch = 0;
        surface.setPointerCapture(event.pointerId);
        surface.style.cursor = "grabbing";
      };
      onDragMove = (event) => {
        if (!this.drag.active || event.pointerId !== this.drag.pointerId) return;
        const now = performance.now();
        const elapsed = Math.max(8e-3, (now - this.drag.lastMove) / 1e3);
        const dx = event.clientX - this.drag.lastX;
        const dy = event.clientY - this.drag.lastY;
        const yaw = dx * DRAG_YAW;
        const pitch = dy * DRAG_PITCH;
        this.drag.yaw += yaw;
        this.drag.pitch = MathUtils2.clamp(this.drag.pitch + pitch, -PITCH_LIMIT, PITCH_LIMIT);
        this.drag.velocityYaw = MathUtils2.clamp(yaw / elapsed, -MAX_THROW_YAW, MAX_THROW_YAW);
        this.drag.velocityPitch = MathUtils2.clamp(
          pitch / elapsed,
          -MAX_THROW_PITCH,
          MAX_THROW_PITCH
        );
        this.drag.lastX = event.clientX;
        this.drag.lastY = event.clientY;
        this.drag.lastMove = now;
      };
      onDragEnd = (event) => {
        if (!this.drag.active || event.pointerId !== this.drag.pointerId) return;
        this.drag.active = false;
        this.drag.pointerId = -1;
        this.drag.releasedAt = performance.now();
        if (performance.now() - this.drag.lastMove > 90) {
          this.drag.velocityYaw = 0;
          this.drag.velocityPitch = 0;
        }
        const surface = this.drag.surface ?? this.canvas;
        if (surface.hasPointerCapture(event.pointerId)) {
          surface.releasePointerCapture(event.pointerId);
        }
        surface.style.cursor = "grab";
        this.drag.surface = null;
      };
      /** Eases the visitor's rotation back to the hero pose during a product change. */
      resetDrag(timeline, at) {
        this.drag.active = false;
        this.drag.velocityYaw = 0;
        this.drag.velocityPitch = 0;
        const home = Math.round(this.drag.yaw / TAU) * TAU;
        timeline.to(
          this.drag,
          { yaw: home, pitch: 0, duration: dur(0.7), ease: MOTION.easeInOut },
          at
        );
      }
      onResize = () => this.resize();
      onVisibility = () => {
        if (document.hidden) this.stop();
        else this.start();
      };
      onPointerMove = (event) => {
        if (event.pointerType === "touch") return;
        this.pointerTarget.set(
          event.clientX / this.width * 2 - 1,
          event.clientY / this.height * 2 - 1
        );
      };
      breakpoint() {
        if (this.width >= 1024) return "desktop";
        if (this.width >= 640) return "tablet";
        return "mobile";
      }
      resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.framing = FRAMING[this.breakpoint()];
        const raw = window.devicePixelRatio || 1;
        const cap = this.breakpoint() === "mobile" ? 1.75 : 2;
        const budget = this.breakpoint() === "mobile" ? 25e5 : 5e6;
        const byArea = Math.sqrt(budget / (this.width * this.height));
        const dpr = Math.max(1, Math.min(raw, cap, byArea));
        this.renderer.setPixelRatio(dpr);
        this.renderer.setSize(this.width, this.height, false);
        this.background?.setAspect(this.width, this.height);
        this.frameCamera();
      }
      /**
       * Positions the camera so the product occupies the same proportion of the
       * frame as the reference composition, at any window size or aspect ratio.
       */
      frameCamera() {
        const model = this.current ?? this.models.values().next().value;
        const productHeight = model?.size.y ?? 0.668;
        const productWidth = model?.size.x ?? 0.98;
        const { elevation, fov } = this.framing;
        const centreX = this.bandOverride ? 0.5 : this.framing.centreX;
        const centreY = this.bandOverride?.centreY ?? this.framing.centreY;
        const fill = this.bandOverride?.fill ?? this.framing.fill;
        this.camera.fov = fov;
        this.camera.aspect = this.width / this.height;
        const halfFov = MathUtils2.degToRad(fov) / 2;
        let distance = productHeight / fill / 2 / Math.tan(halfFov);
        const maxWidthFraction = this.breakpoint() === "desktop" ? 0.46 : 0.78;
        const halfFovX = Math.atan(Math.tan(halfFov) * this.camera.aspect);
        const widthDistance = productWidth / maxWidthFraction / 2 / Math.tan(halfFovX);
        distance = Math.max(distance, widthDistance);
        const el2 = MathUtils2.degToRad(elevation);
        const target = model?.centreY ?? 0.334;
        this.camera.position.set(0, target + Math.sin(el2) * distance, Math.cos(el2) * distance);
        this.camera.lookAt(0, target, 0);
        this.camera.setViewOffset(
          this.width,
          this.height,
          (centreX - 0.5) * -this.width,
          (centreY - 0.5) * -this.height,
          this.width,
          this.height
        );
        this.camera.updateProjectionMatrix();
        this.background?.uCenter.value.set(centreX, 1 - centreY);
        this.ground.group.position.set(0, 0, 0);
      }
      /**
       * Overrides the camera framing with a band measured from the DOM. Used by the
       * scrolling layouts so the product lands exactly in the space reserved for it.
       */
      setHeroBand(band) {
        const same = band === null && this.bandOverride === null || band !== null && this.bandOverride !== null && Math.abs(band.centreY - this.bandOverride.centreY) < 4e-3 && Math.abs(band.fill - this.bandOverride.fill) < 4e-3;
        if (same) return;
        this.bandOverride = band;
        this.frameCamera();
      }
      start() {
        if (this.running || this.disposed) return;
        this.running = true;
        this.lastTime = performance.now();
        this.renderer.setAnimationLoop(this.tick);
      }
      stop() {
        if (!this.running) return;
        this.running = false;
        this.renderer.setAnimationLoop(null);
      }
      tick = () => {
        const now = performance.now();
        const delta = Math.min(0.1, (now - this.lastTime) / 1e3);
        this.lastTime = now;
        this.idleTime += delta;
        const reduced2 = prefersReducedMotion();
        const k = damp(3.4, delta);
        this.pointer.lerp(this.pointerTarget, k);
        const amount = reduced2 ? 0 : 1;
        this.updateDrag(delta, now);
        const settled = this.drag.active ? 0 : 1;
        const idleYaw = Math.sin(this.idleTime * 0.28) * 0.024 * amount * settled;
        const idlePitch = Math.sin(this.idleTime * 0.21 + 1.2) * 0.012 * amount * settled;
        const parallaxAmount = amount * settled;
        const pitch = this.drag.pitch + idlePitch - this.pointer.y * 0.038 * parallaxAmount;
        this.stage.rotation.y = this.drag.yaw + idleYaw + this.pointer.x * 0.075 * parallaxAmount;
        this.stage.rotation.x = pitch;
        const centre = this.current?.centreY ?? 0.334;
        const bob = Math.sin(this.idleTime * 0.34) * 6e-3 * amount * settled;
        this.stage.position.y = bob + centre * (1 - Math.cos(pitch));
        this.stage.position.z = -centre * Math.sin(pitch);
        this.parallax.set(this.pointer.x * -0.012 * amount, this.pointer.y * 0.01 * amount);
        this.background.uParallax.value.copy(this.parallax);
        if (this.post) this.post.render();
        else this.renderer.render(this.scene, this.camera);
      };
      /**
       * Advances the visitor's rotation between frames: momentum from the throw,
       * pitch easing back level, then — once the product has been left alone — a
       * slow drift home to the nearest whole turn.
       */
      updateDrag(delta, now) {
        const d = this.drag;
        if (d.active || prefersReducedMotion()) return;
        if (d.velocityYaw !== 0 || d.velocityPitch !== 0) {
          d.yaw += d.velocityYaw * delta;
          d.pitch = MathUtils2.clamp(d.pitch + d.velocityPitch * delta, -PITCH_LIMIT, PITCH_LIMIT);
          const decay = Math.exp(-THROW_DECAY * delta);
          d.velocityYaw *= decay;
          d.velocityPitch *= decay;
          if (Math.abs(d.velocityYaw) < 2e-3) d.velocityYaw = 0;
          if (Math.abs(d.velocityPitch) < 2e-3) d.velocityPitch = 0;
        }
        if (d.pitch !== 0) {
          d.pitch += (0 - d.pitch) * damp(2.4, delta);
          if (Math.abs(d.pitch) < 5e-4) d.pitch = 0;
        }
        const quiet = (now - d.releasedAt) / 1e3;
        if (d.releasedAt > 0 && quiet > SETTLE_DELAY && d.velocityYaw === 0) {
          const home = Math.round(d.yaw / TAU) * TAU;
          d.yaw += (home - d.yaw) * damp(1.3, delta);
          if (Math.abs(home - d.yaw) < 8e-4) {
            d.yaw = home;
            d.releasedAt = 0;
          }
        }
      }
      /* ------------------------------------------------------------- models -- */
      async ensureModel(product, onProgress) {
        const existing = this.models.get(product.id);
        if (existing) return existing;
        const root2 = await loadModel(product.model, {
          onProgress,
          anisotropy: this.maxAnisotropy
        });
        const model = new ProductModel(root2);
        model.setFinish(product.theme.finish);
        this.models.set(product.id, model);
        await this.warmPipeline(model);
        return model;
      }
      /**
       * Compiles a freshly loaded product against the live scene before it is ever
       * shown.
       *
       * A material's shader is built, and its textures uploaded, the first time it
       * is drawn. Left to happen naturally that lands on the frame the product
       * enters on — the product appears untextured for a beat, then snaps to its
       * finish, which is what read as flickering. Warming it here moves that cost
       * to load time, where nothing is moving.
       */
      async warmPipeline(model) {
        if (this.disposed) return;
        model.group.position.set(WARM_PARK, model.centreY, 0);
        model.setOpacity(1);
        this.stage.add(model.group);
        try {
          model.setDepthMode(true);
          await this.renderer.compileAsync(this.scene, this.camera, this.scene);
          model.setDepthMode(false);
          await this.renderer.compileAsync(this.scene, this.camera, this.scene);
        } catch {
        }
        if (this.current !== model) model.group.removeFromParent();
        model.resetPose();
        model.settle();
      }
      /**
       * True unless the visitor has asked to save data or is on a slow connection —
       * in which case the other campaigns load on demand rather than up front.
       */
      static shouldPrefetch() {
        const nav = navigator;
        if (window.innerWidth < 1024) return false;
        if ((nav.deviceMemory ?? 8) <= 4) return false;
        const connection = nav.connection;
        if (!connection) return true;
        if (connection.saveData) return false;
        return !/(^| )(slow-)?2g$/.test(connection.effectiveType ?? "");
      }
      /**
       * Makes a campaign's model ready to show: fetched, decoded and compiled.
       *
       * Callers must await this before starting a transition. It resolves in a tick
       * once a model is in memory, and can take seconds the first time on a device
       * that does not preload.
       */
      async prepare(product) {
        await this.ensureModel(product);
      }
      /** Loads and warms a campaign's model without displaying it. */
      async preload(product) {
        try {
          await this.ensureModel(product);
        } catch {
        }
      }
      /** Renders a product thumbnail; returns a data URL, or null if unavailable. */
      async thumbnail(product, pose) {
        if (!this.thumbnails) return null;
        try {
          const model = await this.ensureModel(product);
          return await this.thumbnails.capture(model, product, pose);
        } catch {
          return null;
        }
      }
      /* --------------------------------------------------------- transitions -- */
      applyTheme(product, immediate, timeline) {
        const bg = this.background.targets(product.theme);
        const gr = this.ground.targets(product.theme);
        const li = this.lighting.targets(product.theme);
        if (immediate) {
          this.background.uBase.value.copy(bg.base);
          this.background.uMid.value.copy(bg.mid);
          this.background.uGlow.value.copy(bg.glow);
          this.background.uGlowIntensity.value = bg.glowIntensity;
          this.background.uBrushTint.value.copy(bg.brushTint);
          this.background.uBrushOpacity.value = bg.brushOpacity;
          this.ground.uColour.value.copy(gr.colour);
          this.ground.uIntensity.value = gr.intensity;
          this.lighting.apply(product.theme);
          this.scene.environmentIntensity = product.theme.envIntensity;
          return;
        }
        const tl = timeline ?? gsap6.timeline();
        const d = dur(MOTION.crossfade);
        const ease = MOTION.easeInOut;
        const at = 0;
        tl.to(this.background.uBase.value, { ...rgb(bg.base), duration: d, ease }, at).to(this.background.uMid.value, { ...rgb(bg.mid), duration: d, ease }, at).to(this.background.uGlow.value, { ...rgb(bg.glow), duration: d, ease }, at).to(
          this.background.uGlowIntensity,
          { value: bg.glowIntensity, duration: d, ease },
          at
        ).to(this.background.uBrushTint.value, { ...rgb(bg.brushTint), duration: d, ease }, at).to(
          this.background.uBrushOpacity,
          { value: bg.brushOpacity, duration: d, ease },
          at
        ).to(this.ground.uColour.value, { ...rgb(gr.colour), duration: d, ease }, at).to(this.ground.uIntensity, { value: gr.intensity, duration: d, ease }, at).to(this.lighting.key.color, { ...rgb(li.key), duration: d, ease }, at).to(this.lighting.key, { intensity: li.keyIntensity, duration: d, ease }, at).to(this.lighting.fill.color, { ...rgb(li.fill), duration: d, ease }, at).to(this.lighting.fill, { intensity: li.fillIntensity, duration: d, ease }, at).to(this.lighting.rimLeft.color, { ...rgb(li.rim), duration: d, ease }, at).to(this.lighting.rimRight.color, { ...rgb(li.rim), duration: d, ease }, at).to(this.lighting.rimLeft, { intensity: li.rimIntensity, duration: d, ease }, at).to(
          this.lighting.rimRight,
          { intensity: li.rimIntensity * 0.85, duration: d, ease },
          at
        ).to(this.lighting.bounce.color, { ...rgb(li.bounce), duration: d, ease }, at).to(this.scene, { environmentIntensity: product.theme.envIntensity, duration: d, ease }, at);
      }
      /**
       * Choreographs a campaign change onto a caller-supplied timeline so the UI,
       * the model, the lighting and the atmosphere all resolve as one motion.
       */
      transitionTo(product, direction, timeline) {
        const next = this.models.get(product.id);
        if (!next) {
          console.error("[showcase] transitionTo called before prepare", product.id);
          return;
        }
        const outgoing = this.current;
        if (outgoing === next) {
          this.applyTheme(product, false, timeline);
          return;
        }
        this.transitioning = true;
        const reduced2 = prefersReducedMotion();
        if (outgoing) {
          const swapYaw = HERO_YAW + HERO_YAW_OFFSET + direction * (MOTION.turn / 2);
          timeline.to(
            outgoing.group.rotation,
            {
              y: swapYaw,
              duration: dur(MOTION.half),
              ease: MOTION.easeIn,
              onComplete: () => {
                outgoing.group.removeFromParent();
                outgoing.settle();
                outgoing.resetPose();
              }
            },
            0
          ).to(
            outgoing.group.position,
            { z: MOTION.depth, duration: dur(MOTION.half), ease: "power2.out" },
            0
          );
        }
        this.applyTheme(product, false, timeline);
        this.resetDrag(timeline, 0);
        this.background.uSweep.value = 0;
        timeline.fromTo(
          this.background.uSweep,
          { value: 0 },
          { value: 1, duration: dur(MOTION.sweep), ease: "power1.out" },
          0.05
        ).fromTo(
          this.background.uSweepStrength,
          { value: 0 },
          { value: reduced2 ? 0 : 0.3, duration: dur(0.26), ease: "power2.out" },
          0.05
        ).to(this.background.uSweepStrength, { value: 0, duration: dur(0.6), ease: "power2.in" }, 0.42);
        if (!reduced2) {
          const settleAt = MOTION.half * 1.55;
          timeline.to(
            this.ground.uIntensity,
            {
              value: product.theme.groundIntensity * 1.22,
              duration: dur(0.22),
              ease: "power2.out",
              overwrite: "auto"
            },
            settleAt
          ).to(
            this.ground.uIntensity,
            {
              value: product.theme.groundIntensity,
              duration: dur(0.5),
              ease: "power2.inOut",
              overwrite: "auto"
            },
            settleAt + dur(0.22)
          );
        }
        const swapAt = dur(MOTION.half);
        next.resetPose();
        next.setEnvIntensity(product.theme.envIntensity);
        next.setOpacity(0);
        next.group.rotation.y = HERO_YAW + HERO_YAW_OFFSET - direction * (MOTION.turn / 2);
        next.group.position.set(0, next.centreY, MOTION.depth);
        next.group.scale.setScalar(1);
        this.stage.add(next.group);
        this.current = next;
        timeline.call(() => next.setOpacity(1), void 0, swapAt).to(
          next.group.rotation,
          {
            y: HERO_YAW + HERO_YAW_OFFSET,
            duration: dur(MOTION.half),
            ease: "power2.out"
          },
          swapAt
        ).to(
          next.group.position,
          { z: 0, duration: dur(MOTION.half), ease: "power2.in" },
          swapAt
        );
      }
      /** Fades the hero in once loading completes. */
      reveal(timeline) {
        const model = this.current;
        timeline.fromTo(
          this.background.uReveal,
          { value: 0 },
          { value: 1, duration: dur(1.4), ease: "power2.out" },
          0
        );
        timeline.fromTo(
          this.ground.uReveal,
          { value: 0 },
          { value: 1, duration: dur(1.6), ease: "power2.out" },
          0.15
        );
        if (!model) return;
        const appear = { value: 0 };
        model.setOpacity(0);
        timeline.fromTo(
          model.group.position,
          { y: model.centreY - 0.12, z: -0.35 },
          { y: model.centreY, z: 0, duration: dur(1.5), ease: "expo.out" },
          0.05
        ).fromTo(
          model.group.scale,
          { x: 0.9, y: 0.9, z: 0.9 },
          { x: 1, y: 1, z: 1, duration: dur(1.5), ease: "expo.out" },
          0.05
        ).fromTo(
          appear,
          { value: 0 },
          {
            value: 1,
            duration: dur(0.9),
            ease: "power2.out",
            onUpdate: () => model.setOpacity(appear.value),
            onComplete: () => model.settle()
          },
          0.05
        );
      }
      /**
       * On the scrolling mobile/tablet layout the canvas is fixed behind the page,
       * so the product dissolves as content scrolls up to meet it — the atmosphere
       * stays, the hero never sits under the copy.
       */
      setScrollFade(value) {
        const clamped = MathUtils2.clamp(value, 0, 1);
        if (Math.abs(clamped - this.scrollFade) < 4e-3) return;
        this.scrollFade = clamped;
        this.applyScrollFade();
      }
      /**
       * Hands the product's opacity back to the scroll position once a change has
       * finished, and re-applies whatever the visitor scrolled to meanwhile.
       */
      settleScrollFade() {
        this.transitioning = false;
        this.applyScrollFade();
      }
      applyScrollFade() {
        const value = this.scrollFade;
        this.ground.uContact.value = value;
        this.stage.visible = value > 0.01;
        if (this.transitioning) return;
        const model = this.current;
        if (!model) return;
        if (value > 0.995) model.settle();
        else model.setOpacity(value);
      }
      get element() {
        return this.canvas;
      }
      dispose() {
        this.disposed = true;
        this.stop();
        window.removeEventListener("resize", this.onResize);
        window.removeEventListener("pointermove", this.onPointerMove);
        document.removeEventListener("visibilitychange", this.onVisibility);
        for (const model of this.models.values()) model.dispose();
        this.models.clear();
        this.ground.dispose();
        this.thumbnails?.dispose();
        this.environment?.dispose();
        this.renderer.dispose();
      }
    };
  }
});

// src/App.ts
init_products();
import gsap7 from "gsap";

// src/core/theme.ts
init_motion();
function rgba(hex, alpha) {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  const int = parseInt(full, 16);
  return `rgba(${int >> 16 & 255}, ${int >> 8 & 255}, ${int & 255}, ${alpha})`;
}
function tokens(product) {
  const { theme } = product;
  return {
    "--accent": theme.accent,
    "--accent-strong": theme.accentStrong,
    "--accent-soft": rgba(theme.accent, 0.45),
    "--accent-faint": rgba(theme.accent, 0.13),
    "--accent-ink": theme.accentInk,
    "--product-glow": theme.bgGlow,
    "--background": theme.bgBase
  };
}
function applyTheme(product) {
  const root2 = document.documentElement;
  for (const [key, value] of Object.entries(tokens(product))) {
    root2.style.setProperty(key, value);
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", product.theme.bgBase);
}
function transitionTheme(product, timeline) {
  timeline.to(
    document.documentElement,
    { ...tokens(product), duration: dur(1), ease: "power2.inOut" },
    0
  );
  timeline.call(
    () => document.querySelector('meta[name="theme-color"]')?.setAttribute("content", product.theme.bgBase),
    void 0,
    0.5
  );
}

// src/App.ts
init_motion();

// src/core/dom.ts
function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== void 0) node.innerHTML = html;
  return node;
}
function qs(root2, selector) {
  const found = root2.querySelector(selector);
  if (!found) throw new Error(`Missing required element: ${selector}`);
  return found;
}
function qsa(root2, selector) {
  return Array.from(root2.querySelectorAll(selector));
}
function esc(value) {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

// src/core/store.ts
var state = {
  index: 0,
  previousIndex: 0,
  direction: 1,
  phase: "loading",
  menuOpen: false
};
var listeners = /* @__PURE__ */ new Set();
function getState() {
  return state;
}
function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function setState(patch) {
  const prev = { ...state };
  let changed = false;
  for (const key of Object.keys(patch)) {
    if (state[key] !== patch[key]) {
      state[key] = patch[key];
      changed = true;
    }
  }
  if (!changed) return;
  for (const fn of listeners) fn(state, prev);
}

// src/ui/CarouselControls.ts
init_products();
init_motion();

// src/ui/icons.ts
var stroke = (d, w = 1.6) => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
var psLogo = `
<svg class="icon icon--logo" viewBox="0 0 112 60" role="img" aria-label="PlayStation">
  <g fill="currentColor">
    <path fill-rule="evenodd" d="M22.6 3h25.2c13.6 0 22 6.3 22 16.3 0 10.8-9.6 17.6-25.1 17.6h-9.9L32.4 57H17.4L22.6 3Zm12.4 11.6-1.2 12.1h9.4c5.8 0 9.4-2.5 9.4-6.4 0-3.6-3.2-5.7-9-5.7h-8.6Z"/>
    <path d="M104.8 14.9c-3.6-2.7-8.6-4.3-13.4-4.3-4.6 0-7.3 1.8-7.3 4.4 0 2.2 2 3.5 8.1 5.4 9.4 2.9 13.6 6.7 13.6 13.3 0 9.3-8 15.4-19.9 15.4-7.3 0-14.1-2.3-18.6-6.1l7-9.1c3.6 3.1 8.4 5.1 13 5.1 4.2 0 6.7-1.6 6.7-4.2 0-2.3-1.9-3.6-8-5.6-9.1-2.9-13.3-6.6-13.3-13.2C72.7 6.4 80.7.4 92.4.4c6.5 0 12.4 1.9 16.8 5l-4.4 9.5Z"/>
  </g>
</svg>`;
var search = `
<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
  ${stroke("M10.8 17.6a6.8 6.8 0 1 0 0-13.6 6.8 6.8 0 0 0 0 13.6ZM15.7 15.7 20 20", 1.9)}
</svg>`;
var user = `
<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
  ${stroke("M12 12.1a3.7 3.7 0 1 0 0-7.4 3.7 3.7 0 0 0 0 7.4Z", 1.9)}
  ${stroke("M4.9 20a7.4 7.4 0 0 1 14.2 0", 1.9)}
</svg>`;
var bag = `
<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
  ${stroke("M5.4 7.6h13.2l1 12.1a1.4 1.4 0 0 1-1.4 1.5H5.8a1.4 1.4 0 0 1-1.4-1.5Z", 1.8)}
  ${stroke("M8.7 9.6V6.4a3.3 3.3 0 1 1 6.6 0v3.2", 1.8)}
</svg>`;
var cart = `
<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
  ${stroke("M2.6 3.4h2.6l2.3 10.9h9.8l2.1-8H6.2", 1.8)}
  <circle cx="9.4" cy="19" r="1.7" fill="currentColor"/>
  <circle cx="16.6" cy="19" r="1.7" fill="currentColor"/>
</svg>`;
var battery = `
<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
  ${stroke("M8.4 6.2h7.2a2 2 0 0 1 2 2v11.4a2 2 0 0 1-2 2H8.4a2 2 0 0 1-2-2V8.2a2 2 0 0 1 2-2Z", 1.7)}
  ${stroke("M9.9 4.2h4.2", 1.7)}
  <path d="M12.9 9.4 9.6 14.6h2.3l-.8 4.2 3.4-5.4h-2.4Z" fill="currentColor"/>
</svg>`;
var latency = `
<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
  ${stroke("M13.4 2.6 4.8 13.5h6L9.9 21.4l9-11.2h-6.2Z", 1.7)}
</svg>`;
var arrowLeft = `
<svg class="icon" viewBox="0 0 28 16" aria-hidden="true">
  ${stroke("M26 8H2M9 1.5 2 8l7 6.5", 2.1)}
</svg>`;
var arrowRight = `
<svg class="icon" viewBox="0 0 28 16" aria-hidden="true">
  ${stroke("M2 8h24M19 1.5 26 8l-7 6.5", 2.1)}
</svg>`;
var play = `
<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M9 6.4 18.4 12 9 17.6Z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
</svg>`;
var menu = `
<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
  ${stroke("M4 8h16M4 16h16", 1.9)}
</svg>`;
var close = `
<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
  ${stroke("M6 6l12 12M18 6 6 18", 1.9)}
</svg>`;
var dragHandle = `
<svg class="icon" viewBox="0 0 26 12" aria-hidden="true">
  <path d="M8.6 2.4 4.1 6l4.5 3.6Z" fill="currentColor"/>
  <path d="M17.4 2.4 21.9 6l-4.5 3.6Z" fill="currentColor"/>
</svg>`;
var SPEC_ICONS = { battery, latency };

// src/ui/CarouselControls.ts
var CarouselControls = class {
  constructor(initialIndex, onStep) {
    this.onStep = onStep;
    this.element = el("div", "carousel");
    this.element.innerHTML = `
      <div class="carousel__progress" role="group" aria-label="Product position">
        ${PRODUCTS.map(
      (_, i) => `<span class="carousel__segment" data-index="${i}"><i></i></span>`
    ).join("")}
      </div>
      <div class="carousel__buttons">
        <button class="arrow-button arrow-button--prev" type="button" aria-label="Previous controller">
          ${arrowLeft}
        </button>
        <button class="arrow-button arrow-button--next" type="button" aria-label="Next controller">
          ${arrowRight}
        </button>
      </div>
    `;
    this.segments = qsa(this.element, ".carousel__segment");
    this.prev = qs(this.element, ".arrow-button--prev");
    this.next = qs(this.element, ".arrow-button--next");
    this.prev.addEventListener("click", () => this.onStep(-1));
    this.next.addEventListener("click", () => this.onStep(1));
    this.setIndex(initialIndex);
  }
  onStep;
  element;
  segments;
  prev;
  next;
  setIndex(index) {
    this.segments.forEach((segment, i) => segment.classList.toggle("is-active", i === index));
    this.element.setAttribute(
      "aria-label",
      `Controller ${index + 1} of ${PRODUCTS.length}`
    );
  }
  /** Locks navigation while a transition is mid-flight. */
  setBusy(busy) {
    this.prev.disabled = busy;
    this.next.disabled = busy;
    this.element.classList.toggle("is-busy", busy);
  }
  transition(index, timeline, at = 0) {
    timeline.call(() => this.setIndex(index), void 0, at);
  }
  reveal(timeline, at = 0) {
    timeline.fromTo(
      this.element,
      { y: 26, opacity: 0 },
      { y: 0, opacity: 1, duration: dur(0.8), ease: "power3.out" },
      at
    );
  }
};

// src/ui/Header.ts
init_products();
var Header = class {
  constructor(onMenuToggle) {
    this.onMenuToggle = onMenuToggle;
    this.element = el("header", "header");
    this.element.innerHTML = `
      <a class="header__logo" href="/labs/" aria-label="Voltar aos Labs">${psLogo}</a>

      <nav class="header__nav" aria-label="Primary">
        <ul class="nav-pills">
          ${NAV_ITEMS.map(
      (item) => `<li><a class="nav-pill" href="${esc(item.href)}">${esc(item.label)}</a></li>`
    ).join("")}
        </ul>
      </nav>

      <div class="header__utility">
        <button class="utility-button" type="button" aria-label="Search">${search}</button>
        <button class="utility-button" type="button" aria-label="Your account">${user}</button>
        <button class="utility-button" type="button" aria-label="Cart, 0 items">${bag}</button>
        <button class="utility-button utility-button--menu" type="button"
                aria-label="Open menu" aria-expanded="false" aria-controls="mobile-menu">
          ${menu}
        </button>
      </div>
    `;
    this.menuButton = qs(this.element, ".utility-button--menu");
    this.menuButton.addEventListener("click", this.onMenuToggle);
    for (const link of qsa(this.element, ".nav-pill")) {
      link.addEventListener("click", (event) => event.preventDefault());
    }
  }
  onMenuToggle;
  element;
  menuButton;
  setMenuOpen(open) {
    this.menuButton.setAttribute("aria-expanded", String(open));
    this.menuButton.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    this.menuButton.innerHTML = open ? close : menu;
  }
};

// src/ui/Loader.ts
import gsap2 from "gsap";
init_motion();
var Loader = class {
  element;
  bar;
  percent;
  proxy = { value: 0 };
  shown = 0;
  constructor() {
    this.element = el("div", "loader");
    this.element.innerHTML = `
      <div class="loader__glow" aria-hidden="true"></div>
      <div class="loader__mark">${psLogo}</div>
      <div class="loader__meta" role="status" aria-live="polite">
        <p class="loader__label"><span class="bracket">(</span>Preparing the showcase<span class="bracket">)</span></p>
        <div class="loader__bar"><i></i></div>
        <p class="loader__percent">0%</p>
      </div>
    `;
    this.bar = qs(this.element, ".loader__bar i");
    this.percent = qs(this.element, ".loader__percent");
  }
  /** Progress is eased rather than snapped so the bar never stutters. */
  set(ratio) {
    const target = Math.max(this.shown, Math.min(1, ratio));
    this.shown = target;
    gsap2.to(this.proxy, {
      value: target,
      duration: dur(0.5),
      ease: "power2.out",
      onUpdate: () => {
        this.bar.style.transform = `scaleX(${this.proxy.value})`;
        this.percent.textContent = `${Math.round(this.proxy.value * 100)}%`;
      }
    });
  }
  /** Hands off to the hero reveal; resolves when the overlay is gone. */
  dismiss() {
    return gsap2.timeline({
      onComplete: () => {
        this.element.remove();
      }
    }).to(this.percent.parentElement, { opacity: 0, duration: dur(0.3), ease: "power2.in" }).to(
      this.element,
      { opacity: 0, duration: dur(0.7), ease: "power2.inOut" },
      dur(0.15)
    );
  }
};

// src/ui/MobileMenu.ts
init_products();
import gsap3 from "gsap";
init_motion();
var MobileMenu = class {
  constructor(onRequestClose) {
    this.onRequestClose = onRequestClose;
    this.element = el("div", "mobile-menu");
    this.element.id = "mobile-menu";
    this.element.hidden = true;
    this.element.innerHTML = `
      <div class="mobile-menu__panel" role="dialog" aria-modal="true" aria-label="Menu">
        <ul class="mobile-menu__list">
          ${NAV_ITEMS.map(
      (item, index) => `
            <li class="mobile-menu__item">
              <a href="${esc(item.href)}"><span class="mobile-menu__index">0${index + 1}</span>${esc(item.label)}</a>
            </li>`
    ).join("")}
        </ul>
      </div>
    `;
    this.items = qsa(this.element, ".mobile-menu__item");
    for (const link of qsa(this.element, "a")) {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        this.onRequestClose();
      });
    }
    this.element.addEventListener("click", (event) => {
      if (event.target === this.element) this.onRequestClose();
    });
  }
  onRequestClose;
  element;
  items;
  timeline = null;
  open = false;
  toggle(open) {
    if (open === this.open) return;
    this.open = open;
    this.timeline?.kill();
    if (open) {
      this.element.hidden = false;
      this.timeline = gsap3.timeline().fromTo(
        this.element,
        { opacity: 0 },
        { opacity: 1, duration: dur(0.3), ease: "power2.out" }
      ).fromTo(
        this.items,
        { y: 26, opacity: 0 },
        { y: 0, opacity: 1, duration: dur(0.55), stagger: 0.055, ease: "power3.out" },
        0.06
      );
      qsa(this.element, "a")[0]?.focus();
    } else {
      this.timeline = gsap3.timeline({
        onComplete: () => {
          this.element.hidden = true;
        }
      });
      this.timeline.to(this.items, { y: -14, opacity: 0, duration: dur(0.22), ease: "power2.in" }).to(this.element, { opacity: 0, duration: dur(0.24), ease: "power2.in" }, 0.08);
    }
  }
};

// src/ui/ProductIndicator.ts
init_products();
var ProductIndicator = class {
  element;
  constructor() {
    this.element = el("div", "indicator");
    this.element.innerHTML = `
      <svg class="indicator__arc" viewBox="0 0 26 150" aria-hidden="true" preserveAspectRatio="none">
        <path d="M23 3C10 28 4 62 5 92c.4 20 3 38 8 55"
              fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"
              opacity="0.42" vector-effect="non-scaling-stroke"/>
      </svg>
      <p class="indicator__label">
        <span class="bracket">(</span>${PRODUCT_INDICATOR}<span class="bracket">)</span>
      </p>
    `;
  }
};

// src/ui/ProductInfo.ts
init_motion();
var ProductInfo = class {
  element;
  category;
  line1;
  line2;
  description;
  price;
  cta;
  constructor(product) {
    this.element = el("section", "product-info");
    this.element.setAttribute("aria-live", "polite");
    this.element.innerHTML = `
      <p class="product-info__category"><span class="bracket">(</span><span class="product-info__category-text"></span><span class="bracket">)</span></p>
      <h1 class="product-info__title">
        <span class="product-info__line"><span class="product-info__line-inner" data-line="1"></span></span>
        <span class="product-info__line"><span class="product-info__line-inner" data-line="2"></span></span>
      </h1>
      <p class="product-info__description"></p>
      <div class="product-info__actions">
        <button class="cta" type="button">
          <span class="cta__icon">${cart}</span>
          <span class="cta__label">Add to cart</span>
        </button>
        <p class="product-info__price"></p>
      </div>
    `;
    this.category = qs(this.element, ".product-info__category-text");
    this.line1 = qs(this.element, '[data-line="1"]');
    this.line2 = qs(this.element, '[data-line="2"]');
    this.description = qs(this.element, ".product-info__description");
    this.price = qs(this.element, ".product-info__price");
    this.cta = qs(this.element, ".cta");
    this.write(product);
  }
  write(product) {
    this.category.textContent = product.category;
    this.line1.textContent = product.titleLines[0];
    this.line2.textContent = product.titleLines[1];
    this.description.textContent = product.description;
    this.price.innerHTML = `<span class="visually-hidden">Price </span>${esc(product.price)}`;
    this.cta.setAttribute("aria-label", `Add ${product.name} to cart`);
  }
  get lines() {
    return [this.category.parentElement, this.line1, this.line2];
  }
  get tail() {
    return [this.description, qs(this.element, ".product-info__actions")];
  }
  /** Adds this block's half of a campaign change to the shared timeline. */
  transition(product, timeline, at = 0) {
    const out = [...this.lines, ...this.tail];
    timeline.to(
      out,
      {
        yPercent: -42,
        opacity: 0,
        duration: dur(0.3),
        ease: "power2.in",
        stagger: 0.03
      },
      at
    ).call(() => this.write(product), void 0, at + dur(0.32)).fromTo(
      this.lines,
      { yPercent: 62, opacity: 0 },
      {
        yPercent: 0,
        opacity: 1,
        duration: dur(0.72),
        ease: "power3.out",
        stagger: 0.05
      },
      at + dur(0.36)
    ).fromTo(
      this.tail,
      // yPercent is reset explicitly: the exit tween moves these elements by
      // percentage and the entrance moves them by pixels, so the percentage
      // offset would otherwise persist and pull the copy up.
      { y: 22, yPercent: 0, opacity: 0 },
      { y: 0, yPercent: 0, opacity: 1, duration: dur(0.62), ease: "power3.out", stagger: 0.06 },
      at + dur(0.46)
    );
  }
  /** Intro reveal used once, after the first model is ready. */
  reveal(timeline, at = 0) {
    timeline.fromTo(
      this.lines,
      { yPercent: 92, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: dur(1), ease: "expo.out", stagger: 0.08 },
      at
    ).fromTo(
      this.tail,
      { y: 28, yPercent: 0, opacity: 0 },
      { y: 0, yPercent: 0, opacity: 1, duration: dur(0.85), ease: "power3.out", stagger: 0.09 },
      at + 0.18
    );
  }
};

// src/ui/ProductVariants.ts
init_products();
import gsap4 from "gsap";
init_motion();
var SLOTS = [
  { width: 1, height: 1.316, opacity: 1 },
  { width: 0.786, height: 1.113, opacity: 0.82 }
];
var GAP = 0.133;
var ProductVariants = class {
  constructor(initialIndex, onSelect) {
    this.onSelect = onSelect;
    this.index = initialIndex;
    this.element = el("div", "variants");
    this.element.innerHTML = `
      <i class="variants__probe" aria-hidden="true"></i>
      <ul class="variants__track" aria-label="Other controllers">
        ${PRODUCTS.map(
      (product, i) => `
          <li class="variants__item" data-index="${i}">
            <button class="variant-card" type="button" data-index="${i}">
              <span class="variant-card__surface" aria-hidden="true"></span>
              <span class="variant-card__media">
                <img class="variant-card__image" alt="" decoding="async" />
              </span>
              <span class="visually-hidden">Show ${esc(product.name)}</span>
            </button>
          </li>`
    ).join("")}
      </ul>
    `;
    this.items = qsa(this.element, ".variants__item");
    this.cards = qsa(this.element, ".variant-card");
    for (const card of this.cards) {
      card.addEventListener("click", () => {
        const target = Number(card.dataset.index);
        if (target !== this.index) this.onSelect(target);
      });
      card.addEventListener("keydown", (event) => this.onKeydown(event));
    }
    this.layout(initialIndex, true);
    this.observer = new ResizeObserver(() => this.layout(this.index, true));
    this.observer.observe(this.element);
  }
  onSelect;
  element;
  cards;
  items;
  index;
  observer;
  onKeydown(event) {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const order = this.order(this.index);
    const current = order.indexOf(Number(event.currentTarget.dataset.index));
    const next = order[(current + delta + order.length) % order.length];
    this.cards[next].focus();
  }
  /** The campaigns after the active one, wrapping — the order they queue up in. */
  order(active) {
    return PRODUCTS.map((_, i) => i).filter((i) => i !== active).sort((a, b) => {
      const da = (a - active + PRODUCTS.length) % PRODUCTS.length;
      const db = (b - active + PRODUCTS.length) % PRODUCTS.length;
      return da - db;
    });
  }
  /**
   * The slot unit, in pixels.
   *
   * Measured from a zero-height probe rather than read off the custom property:
   * `--card-w` is a `clamp()`, and a custom property holding one is returned
   * verbatim by `getComputedStyle` — it is only resolved where it is used.
   */
  cardWidth() {
    const probe = this.element.querySelector(".variants__probe");
    return probe?.getBoundingClientRect().width || 180;
  }
  /**
   * Places every card in its slot. Cards that have no slot are parked just off
   * the trailing edge, so they leave and arrive along the rail rather than
   * appearing out of nowhere.
   */
  layout(active, immediate = false) {
    this.index = active;
    const stacked = window.innerWidth < 1024;
    const width = this.cardWidth();
    const order = this.order(active);
    let cursor = 0;
    const placements = /* @__PURE__ */ new Map();
    order.forEach((productIndex, position) => {
      const slot = SLOTS[Math.min(position, SLOTS.length - 1)];
      placements.set(productIndex, { x: cursor, slot: Math.min(position, SLOTS.length - 1) });
      cursor += width * slot.width + width * GAP;
    });
    const parked = cursor;
    this.items.forEach((item, i) => {
      const card = this.cards[i];
      const placement = placements.get(i);
      const hidden = !placement;
      const slot = SLOTS[placement?.slot ?? SLOTS.length - 1];
      card.setAttribute("aria-hidden", String(hidden));
      card.tabIndex = hidden ? -1 : 0;
      card.classList.toggle("is-lead", placement?.slot === 0);
      const to = {
        x: stacked ? 0 : placement?.x ?? parked,
        width: stacked ? "" : `${width * slot.width}px`,
        height: stacked ? "" : `${width * slot.height}px`,
        opacity: hidden ? 0 : slot.opacity,
        duration: immediate || prefersReducedMotion() ? 0 : dur(0.75),
        ease: "power3.out",
        overwrite: "auto"
      };
      if (stacked) {
        gsap4.set(item, { clearProps: "transform" });
        item.style.transform = "";
        card.style.width = "";
        card.style.height = "";
        item.style.display = hidden ? "none" : "";
        card.style.opacity = "1";
        return;
      }
      item.style.display = "";
      gsap4.to(item, {
        x: to.x,
        yPercent: -50,
        duration: to.duration,
        ease: to.ease,
        overwrite: "auto"
      });
      gsap4.to(card, {
        width: to.width,
        height: to.height,
        opacity: to.opacity,
        duration: to.duration,
        ease: to.ease,
        overwrite: "auto"
      });
    });
  }
  /**
   * Card artwork. Studio photography where a campaign has it, otherwise a still
   * rendered from its own model.
   */
  setArtwork(index, src, label) {
    const card = this.cards[index];
    const image = card?.querySelector(".variant-card__image");
    if (!image) return;
    const reveal = () => {
      if (card.classList.contains("has-artwork")) return;
      card.classList.add("has-artwork");
      gsap4.fromTo(
        image,
        { opacity: 0, scale: 0.94 },
        { opacity: 1, scale: 1, duration: dur(0.7), ease: "power3.out" }
      );
    };
    if (image.src === new URL(src, location.href).href) {
      reveal();
      return;
    }
    image.alt = label;
    image.addEventListener("load", reveal, { once: true });
    image.src = src;
    if (image.complete && image.naturalWidth > 0) reveal();
  }
  transition(_product, index, timeline, at = 0) {
    timeline.call(() => this.layout(index), void 0, at);
  }
  reveal(timeline, at = 0) {
    timeline.from(
      this.cards,
      {
        opacity: 0,
        scale: 0.9,
        duration: dur(0.9),
        ease: "power3.out",
        stagger: 0.08,
        transformOrigin: "50% 50%"
      },
      at
    );
  }
  destroy() {
    this.observer.disconnect();
  }
};

// src/ui/PromoCard.ts
import gsap5 from "gsap";
init_motion();
var PromoCard = class {
  element;
  title;
  caption;
  duration;
  image;
  figure;
  constructor(product) {
    this.element = el("article", "promo-card");
    this.element.innerHTML = `
      <button class="promo-card__button" type="button">
        <span class="promo-card__art">
          <span class="promo-card__wash" aria-hidden="true"></span>
          <span class="promo-card__grain" aria-hidden="true"></span>
          <span class="promo-card__figure">
            <img class="promo-card__image" alt="" decoding="async" />
          </span>
          <svg class="promo-card__corner" viewBox="0 0 46 46" aria-hidden="true">
            <path d="M0 0h46L0 46Z" fill="url(#promo-corner)"/>
            <defs>
              <linearGradient id="promo-corner" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#2f7fe0"/>
                <stop offset="1" stop-color="#7ec6ff"/>
              </linearGradient>
            </defs>
          </svg>
        </span>
        <span class="promo-card__copy">
          <span class="promo-card__title"></span>
          <span class="promo-card__caption"></span>
        </span>
        <span class="promo-card__play">${play}</span>
        <span class="promo-card__duration"></span>
      </button>
    `;
    this.title = qs(this.element, ".promo-card__title");
    this.caption = qs(this.element, ".promo-card__caption");
    this.duration = qs(this.element, ".promo-card__duration");
    this.image = qs(this.element, ".promo-card__image");
    this.figure = qs(this.element, ".promo-card__figure");
    this.write(product);
  }
  write(product) {
    this.title.textContent = product.promo.title;
    this.caption.textContent = product.promo.caption;
    this.duration.textContent = product.promo.duration;
    qs(this.element, ".promo-card__button").setAttribute(
      "aria-label",
      `Play ${product.promo.title} \u2014 ${product.promo.caption}, ${product.promo.duration}`
    );
  }
  setArtwork(src) {
    this.image.src = src;
    this.image.addEventListener(
      "load",
      () => {
        gsap5.fromTo(
          this.figure,
          { opacity: 0, scale: 1.08 },
          { opacity: 1, scale: 1, duration: dur(0.8), ease: "power3.out" }
        );
      },
      { once: true }
    );
  }
  transition(product, timeline, at = 0) {
    const copy = [this.title, this.caption];
    timeline.to(copy, { y: -14, opacity: 0, duration: dur(0.26), ease: "power2.in" }, at).to(this.figure, { opacity: 0, duration: dur(0.3), ease: "power2.in" }, at).call(() => this.write(product), void 0, at + dur(0.3)).fromTo(
      copy,
      { y: 16, opacity: 0 },
      { y: 0, opacity: 1, duration: dur(0.6), ease: "power3.out", stagger: 0.05 },
      at + dur(0.42)
    );
  }
  reveal(timeline, at = 0) {
    timeline.fromTo(
      this.element,
      { y: 34, opacity: 0 },
      { y: 0, opacity: 1, duration: dur(0.9), ease: "power3.out" },
      at
    );
  }
};

// src/ui/SpecCards.ts
init_motion();
var SpecCards = class {
  element;
  cards;
  constructor(product) {
    this.element = el("ul", "spec-cards");
    this.element.setAttribute("aria-label", "Key specifications");
    this.element.innerHTML = product.specs.map(
      (spec) => `
        <li class="spec-card">
          <span class="spec-card__icon">${SPEC_ICONS[spec.icon]}</span>
          <span class="spec-card__body">
            <span class="spec-card__value">${esc(spec.value)}</span>
            <span class="spec-card__label">${esc(spec.label)}</span>
          </span>
        </li>`
    ).join("");
    this.cards = qsa(this.element, ".spec-card");
  }
  write(product) {
    product.specs.forEach((spec, i) => {
      const card = this.cards[i];
      if (!card) return;
      card.querySelector(".spec-card__icon").innerHTML = SPEC_ICONS[spec.icon];
      card.querySelector(".spec-card__value").textContent = spec.value;
      card.querySelector(".spec-card__label").textContent = spec.label;
    });
  }
  transition(product, timeline, at = 0) {
    const bodies = this.cards.map((card) => card.querySelector(".spec-card__body"));
    timeline.to(
      bodies,
      { y: -12, opacity: 0, duration: dur(0.26), ease: "power2.in", stagger: 0.04 },
      at
    ).call(() => this.write(product), void 0, at + dur(0.32)).fromTo(
      bodies,
      { y: 14, opacity: 0 },
      { y: 0, opacity: 1, duration: dur(0.6), ease: "power3.out", stagger: 0.06 },
      at + dur(0.44)
    );
  }
  reveal(timeline, at = 0) {
    timeline.fromTo(
      this.cards,
      { y: 34, opacity: 0 },
      { y: 0, opacity: 1, duration: dur(0.9), ease: "power3.out", stagger: 0.09 },
      at
    );
  }
};

// src/App.ts
var App = class {
  // The WebGL layer is code-split: the loading composition paints from HTML and
  // CSS alone, so the three.js bundle never blocks the first frame.
  scene;
  loader = new Loader();
  header;
  menu;
  info;
  variants;
  controls;
  promo;
  specs;
  shell;
  heroSpace;
  queued = null;
  async mount(root2) {
    const product = PRODUCTS[0];
    applyTheme(product);
    const stage = el("div", "stage");
    stage.id = "top";
    this.shell = el("div", "shell");
    this.header = new Header(() => this.toggleMenu());
    this.menu = new MobileMenu(() => this.toggleMenu(false));
    this.info = new ProductInfo(product);
    this.variants = new ProductVariants(0, (index) => this.goTo(index));
    this.controls = new CarouselControls(0, (direction) => this.step(direction));
    this.promo = new PromoCard(product);
    this.specs = new SpecCards(product);
    const indicator = new ProductIndicator();
    const handle = el("div", "stage__handle", dragHandle);
    handle.setAttribute("aria-hidden", "true");
    this.heroSpace = el("div", "hero__space");
    this.heroSpace.setAttribute("aria-hidden", "true");
    const hero = el("main", "hero");
    hero.append(
      this.info.element,
      indicator.element,
      this.heroSpace,
      this.variants.element,
      handle,
      this.controls.element
    );
    const footer = el("div", "hero__footer");
    footer.append(this.promo.element, this.specs.element);
    this.shell.append(this.header.element, hero, footer);
    root2.append(stage, this.shell, this.menu.element, this.loader.element);
    try {
      const { ProductScene: ProductScene2 } = await Promise.resolve().then(() => (init_ProductScene(), ProductScene_exports));
      this.scene = new ProductScene2();
      await this.scene.init(stage, (ratio) => this.loader.set(ratio));
    } catch (error) {
      this.failGracefully(error);
      return;
    }
    this.scene.attachDragSurface(this.heroSpace);
    this.measureHeroBand();
    this.bindInput();
    setState({ phase: "intro" });
    this.playIntro();
    const idle = window.requestIdleCallback;
    if (idle) idle(() => void this.warm(), { timeout: 3e3 });
    else window.setTimeout(() => void this.warm(), 1200);
  }
  /* -------------------------------------------------------------- intro -- */
  playIntro() {
    const timeline = gsap7.timeline({ onComplete: () => setState({ phase: "idle" }) });
    timeline.add(this.loader.dismiss(), 0);
    this.scene.reveal(timeline);
    timeline.fromTo(
      this.header.element,
      { y: -22, opacity: 0 },
      { y: 0, opacity: 1, duration: dur(0.9), ease: "power3.out" },
      0.25
    );
    this.info.reveal(timeline, 0.35);
    this.variants.reveal(timeline, 0.45);
    this.controls.reveal(timeline, 0.6);
    this.promo.reveal(timeline, 0.55);
    this.specs.reveal(timeline, 0.6);
  }
  /**
   * Resolves the artwork for a card or the promotional panel.
   *
   * Studio photography wins where a campaign has it — it is the real product,
   * and it needs no GPU work. Everything else is rendered from that campaign's
   * own model, so no placeholder imagery is ever shown.
   */
  async artwork(product, kind) {
    const photograph = kind === "card" ? product.photography?.front : product.photography?.back;
    if (photograph) return photograph;
    return this.scene.thumbnail(product, kind === "card" ? "front" : "angled");
  }
  /**
   * Prepares the remaining campaigns and every piece of product artwork.
   *
   * On a metered or slow connection only the campaign on show is prepared; the
   * others load when they are actually selected, and their cards hold a lit
   * placeholder until then.
   */
  async warm() {
    const { ProductScene: ProductScene2 } = await Promise.resolve().then(() => (init_ProductScene(), ProductScene_exports));
    const prefetch = ProductScene2.shouldPrefetch();
    const active = PRODUCTS[getState().index];
    const promo = await this.artwork(active, "promo");
    if (promo && PRODUCTS[getState().index] === active) this.promo.setArtwork(promo);
    for (let i = 0; i < PRODUCTS.length; i++) {
      const product = PRODUCTS[i];
      if (!product.photography && !prefetch && i !== getState().index) continue;
      const art = await this.artwork(product, "card");
      if (art) this.variants.setArtwork(i, art, product.name);
    }
    if (!prefetch) return;
    for (let i = 0; i < PRODUCTS.length; i++) {
      if (i !== getState().index) await this.scene.preload(PRODUCTS[i]);
    }
  }
  /* --------------------------------------------------------- navigation -- */
  step(direction) {
    const { index } = getState();
    const next = (index + direction + PRODUCTS.length) % PRODUCTS.length;
    this.goTo(next);
  }
  goTo(index) {
    const state2 = getState();
    if (index === state2.index && state2.phase !== "loading") return;
    if (state2.phase === "transitioning") {
      this.queued = index;
      return;
    }
    void this.transition(index);
  }
  async transition(index) {
    const state2 = getState();
    const from = state2.index;
    const product = PRODUCTS[index];
    const forward = (index - from + PRODUCTS.length) % PRODUCTS.length;
    const backward = (from - index + PRODUCTS.length) % PRODUCTS.length;
    const direction = forward <= backward ? 1 : -1;
    setState({ phase: "transitioning", index, previousIndex: from, direction });
    this.controls.setBusy(true);
    this.updateDocument(product);
    try {
      await this.scene.prepare(product);
    } catch (error) {
      console.error("[showcase] could not prepare campaign", product.id, error);
      setState({ phase: "idle" });
      this.controls.setBusy(false);
      return;
    }
    if (getState().index !== index) {
      this.controls.setBusy(false);
      return;
    }
    const timeline = gsap7.timeline({
      onComplete: () => {
        setState({ phase: "idle" });
        this.controls.setBusy(false);
        this.scene.settleScrollFade();
        const queued = this.queued;
        this.queued = null;
        if (queued !== null && queued !== getState().index) void this.transition(queued);
      }
    });
    transitionTheme(product, timeline);
    this.info.transition(product, timeline, 0);
    this.variants.transition(product, index, timeline, 0.12);
    this.controls.transition(index, timeline, 0.12);
    this.promo.transition(product, timeline, 0.06);
    this.specs.transition(product, timeline, 0.08);
    this.scene.transitionTo(product, direction, timeline);
    timeline.call(
      () => {
        void this.artwork(product, "promo").then((art) => {
          if (art && getState().index === index) this.promo.setArtwork(art);
        });
        void this.artwork(product, "card").then((art) => {
          if (art) this.variants.setArtwork(index, art, product.name);
        });
      },
      void 0,
      ">"
    );
  }
  /**
   * Ties the camera framing to the laid-out band on the scrolling breakpoints,
   * so the product is always centred in the gap the layout leaves for it.
   */
  measureHeroBand() {
    if (window.innerWidth >= 1024) {
      this.scene.setHeroBand(null);
      return;
    }
    const rect = this.heroSpace.getBoundingClientRect();
    if (rect.height < 40) return;
    const top = rect.top + window.scrollY;
    const centre = (top + rect.height / 2) / window.innerHeight;
    const fill = Math.min(0.34, rect.height * 0.78 / window.innerHeight);
    this.scene.setHeroBand({ centreY: centre, fill });
  }
  updateDocument(product) {
    document.title = `${product.titleLines.join(" ")} \xB7 PlayStation DualSense`;
  }
  /* -------------------------------------------------------------- input -- */
  toggleMenu(force) {
    const open = force ?? !getState().menuOpen;
    setState({ menuOpen: open });
    this.header.setMenuOpen(open);
    this.menu.toggle(open);
    document.body.classList.toggle("menu-open", open);
  }
  bindInput() {
    window.addEventListener("keydown", (event) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape" && getState().menuOpen) {
        this.toggleMenu(false);
        return;
      }
      const target = event.target;
      if (target && target.closest(".variants")) return;
      if (event.key === "ArrowRight") this.step(1);
      if (event.key === "ArrowLeft") this.step(-1);
    });
    let startX = 0;
    let startY = 0;
    let tracking = false;
    const surface = this.shell;
    surface.addEventListener(
      "touchstart",
      (event) => {
        if (event.touches.length !== 1) return;
        if (event.target?.closest(".hero__space")) return;
        tracking = true;
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
      },
      { passive: true }
    );
    surface.addEventListener(
      "touchend",
      (event) => {
        if (!tracking) return;
        tracking = false;
        const touch = event.changedTouches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        if (Math.abs(dx) < 52 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
        this.step(dx < 0 ? 1 : -1);
      },
      { passive: true }
    );
    const onScroll = () => {
      if (window.innerWidth >= 1024) {
        this.scene.setScrollFade(1);
        return;
      }
      this.measureHeroBand();
      const ratio = window.scrollY / Math.max(1, window.innerHeight);
      const fade = 1 - Math.min(1, Math.max(0, (ratio - 0.16) / 0.42));
      this.scene.setScrollFade(prefersReducedMotion() ? 1 : fade);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", () => {
      this.measureHeroBand();
      onScroll();
    }, { passive: true });
    this.measureHeroBand();
    onScroll();
    subscribe((state2) => {
      document.body.classList.toggle("is-transitioning", state2.phase === "transitioning");
    });
  }
  /* --------------------------------------------------------- resilience -- */
  failGracefully(error) {
    console.error("[showcase] WebGL initialisation failed", error);
    this.loader.element.remove();
    document.body.classList.add("no-webgl");
    const notice = el(
      "p",
      "webgl-notice",
      "Este lab precisa de WebGL para renderizar o DualSense em 3D. Ative a aceleração de hardware ou tente outro navegador."
    );
    qs(this.shell, ".hero").append(notice);
  }
};

// src/entry.js
var root = document.getElementById("app");
if (!root) throw new Error("#app root not found");
var app = new App();
void app.mount(root);
