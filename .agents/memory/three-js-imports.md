---
name: Three.js multiple instances warning with R3F
description: How to avoid runtime duplicate Three.js import warning when using STLLoader alongside @react-three/fiber
---

When `import * as THREE from "three"` appears alongside `@react-three/fiber` / `@react-three/drei`, Three.js emits "Multiple instances of Three.js being imported" because pnpm installs multiple copies (three@0.x as a direct dep, drei's bundled three, etc.).

**Why:** Three.js singleton checks `self.__THREE` at runtime; if two copies load, both set different values and warn.

**How to apply:**
- Use `import type { BufferGeometry }` (type-only, erased at build time) for type annotations
- Replace `new THREE.Box3()` / `new THREE.Vector3()` calls with geometry built-in methods: `geometry.computeBoundingBox()` then read `geometry.boundingBox` (already a Box3 set on the geometry object)
- The STLLoader from `three/examples/jsm/loaders/STLLoader.js` uses its own bundled three instance which is fine; just don't add an extra runtime `import * as THREE from "three"`
