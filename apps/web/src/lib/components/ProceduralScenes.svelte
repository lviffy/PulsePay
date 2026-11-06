<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { onFrame, gsap, ScrollTrigger } from '$lib/motion';
	import noise from '../../shaders/noise.glsl';
	import ringVertex from '../../shaders/rings.vert.glsl';
	import ringFragment from '../../shaders/rings.frag.glsl';
	import fieldVertex from '../../shaders/field.vert.glsl';
	import fieldFragment from '../../shaders/field.frag.glsl';

	const phrases = [
		'PULSEPAY · ',
		'EXACT USDT OUT · ',
		'WHITECHAIN · HEDERA X402 · ',
		'PAY WITH ANY TOKEN · ',
		'REFUNDS FROM RESERVE · ',
		'AGENTS PAY · NOBODY APPROVES · ',
		'EVERY CALL AUDITED · ',
		'SUBSCRIPTIONS · CSV EXPORT · ',
		'PULSEPAY · ',
		'ANY TOKEN IN · EXACT USDT OUT · '
	];

	function atlas() {
		const canvas = document.createElement('canvas');
		canvas.width = 768;
		canvas.height = 384;
		const ctx = canvas.getContext('2d')!;
		ctx.fillStyle = '#f1efe7';
		ctx.font = `42px ${getComputedStyle(document.documentElement).getPropertyValue('--font-mono') || 'monospace'}`;
		ctx.textBaseline = 'middle';
		ctx.textAlign = 'center';
		for (let i = 0; i < 96; i++) {
			ctx.fillText(String.fromCharCode(i + 32), (i % 16) * 48 + 24, Math.floor(i / 16) * 64 + 32);
		}
		const texture = new THREE.CanvasTexture(canvas);
		texture.flipY = false;
		return texture;
	}

	let canvas = $state<HTMLCanvasElement | null>(null);

	onMount(() => {
		if (
			window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
			((navigator as any).deviceMemory || 8) <= 2
		)
			return;

		if (!canvas) return;
		const element = canvas;
		let renderer: THREE.WebGLRenderer;
		try {
			renderer = new THREE.WebGLRenderer({
				canvas: element,
				alpha: true,
				antialias: false,
				powerPreference: 'low-power'
			});
		} catch {
			// Fallback: 2D poster
			const context = element.getContext('2d');
			if (!context) return;
			const poster = new window.Image();
			let loaded = false;
			const panel = document.querySelector<HTMLElement>('[data-scene=rings]');
			const paint = () => {
				element.width = window.innerWidth;
				element.height = window.innerHeight;
				if (!loaded || !panel) return;
				const box = panel.getBoundingClientRect();
				if (box.bottom < 0 || box.top > window.innerHeight) return;
				context.save();
				context.beginPath();
				context.rect(box.left, box.top, box.width, box.height);
				context.clip();
				const size = Math.max(box.width, box.height) * 1.15;
				context.drawImage(
					poster,
					box.left + (box.width - size) / 2,
					box.top + (box.height - size) / 2,
					size,
					size
				);
				context.restore();
			};
			poster.onload = () => {
				loaded = true;
				paint();
			};
			poster.src = '/rings.svg';
			window.addEventListener('resize', paint);
			window.addEventListener('scroll', paint, { passive: true });
			return () => {
				poster.onload = null;
				window.removeEventListener('resize', paint);
				window.removeEventListener('scroll', paint);
			};
		}

		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.autoClear = false;
		const glyphAtlas = atlas();
		const hero = document.querySelector<HTMLElement>("[data-scene='rings']");
		if (!hero) return;
		const field = document.querySelector<HTMLElement>("[data-scene='field']");
		const geo = new THREE.InstancedBufferGeometry();
		const plane = new THREE.PlaneGeometry(1, 1);
		geo.index = plane.index;
		geo.attributes = plane.attributes;
		const rings: number[] = [],
			glyphs: number[] = [],
			slots: number[] = [],
			counts: number[] = [];

		for (let r = 0; r < 10; r++) {
			const phrase = phrases[r];
			const count =
				Math.max(
					1,
					Math.round((2 * Math.PI * (0.56 + r * 0.52)) / (0.11 + r * 0.012) / phrase.length)
				) * phrase.length;
			for (let i = 0; i < count; i++) {
				rings.push(r);
				glyphs.push(phrase.charCodeAt(i % phrase.length) - 32);
				slots.push(i);
				counts.push(count);
			}
		}

		for (const [name, values] of Object.entries({
			aRing: rings,
			aGlyph: glyphs,
			aSlot: slots,
			aCount: counts
		})) {
			geo.setAttribute(name, new THREE.InstancedBufferAttribute(new Float32Array(values), 1));
		}
		geo.instanceCount = rings.length;

		const uniforms = {
			uTime: { value: 0 },
			uScroll: { value: 0 },
			uReveal: { value: 1 },
			uPointer: { value: new THREE.Vector2() },
			uResolution: { value: new THREE.Vector2(800, 800) },
			uAtlas: { value: glyphAtlas }
		};

		const material = new THREE.ShaderMaterial({
			vertexShader: noise + ringVertex,
			fragmentShader: noise + ringFragment,
			uniforms,
			transparent: true,
			side: THREE.DoubleSide,
			depthWrite: false
		});

		const scene = new THREE.Scene();
		const mesh = new THREE.Mesh(geo, material);
		mesh.frustumCulled = false;
		scene.add(mesh);

		const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 30);
		camera.position.z = 6;
		const raycaster = new THREE.Raycaster();
		const pointer = new THREE.Vector2();
		const target = new THREE.Vector3();
		const hitPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
		const cursor = new THREE.Vector2();

		const move = (e: PointerEvent) => {
			const rect = hero.getBoundingClientRect();
			pointer.set(
				((e.clientX - rect.left) / rect.width) * 2 - 1,
				-((e.clientY - rect.top) / rect.height) * 2 + 1
			);
			raycaster.setFromCamera(pointer, camera);
			raycaster.ray.intersectPlane(hitPlane, target);
			cursor.set(target.x, target.y);
		};
		hero.addEventListener('pointermove', move, { passive: true });

		const text = document.createElement('canvas');
		text.width = 1200;
		text.height = 900;
		const ctx = text.getContext('2d')!;
		ctx.fillStyle = '#000';
		ctx.fillRect(0, 0, 1200, 900);
		ctx.fillStyle = '#fff';

		const headline =
			document.querySelector('.feature-intro h2')?.textContent || 'Every payment has a next step';
		ctx.font = 'bold 52px monospace';
		ctx.fillText(headline.toUpperCase(), 45, 90, 1110);
		ctx.font = '24px monospace';
		let textY = 155;
		document.querySelectorAll('.feature-entry').forEach((entry) => {
			const copy = `${entry.querySelector('h3')?.textContent} ${entry.querySelector('p')?.textContent}`;
			const words = copy.split(/\s+/);
			let line = '';
			for (const word of words) {
				if ((line + word).length > 75) {
					ctx.fillText(line, 45, textY);
					textY += 22;
					line = '';
				}
				line += word + ' ';
			}
			ctx.fillText(line, 45, textY);
			textY += 35;
		});
		ctx.font = '26px monospace';
		ctx.fillText('TOKENS · CHAINS · REFUNDS · RESERVE · 402 · AUDIT', 45, 875);

		const textTexture = new THREE.CanvasTexture(text);
		const healing = new Uint8Array(80 * 40);
		const healingTexture = new THREE.DataTexture(healing, 80, 40, THREE.RedFormat);
		healingTexture.needsUpdate = true;

		const fieldUniforms = {
			uAtlas: { value: glyphAtlas },
			uText: { value: textTexture },
			uHealing: { value: healingTexture },
			uTime: { value: 0 },
			uReveal: { value: 0 },
			uResolution: { value: new THREE.Vector2(1200, 900) }
		};

		const fieldMaterial = new THREE.ShaderMaterial({
			vertexShader: fieldVertex,
			fragmentShader: noise + fieldFragment,
			uniforms: fieldUniforms
		});

		const fieldGeo = new THREE.PlaneGeometry(2, 2);
		const fieldScene = new THREE.Scene();
		fieldScene.add(new THREE.Mesh(fieldGeo, fieldMaterial));
		const fieldCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

		const brush = { x: -10, y: -10, active: false };
		const disturb = (e: PointerEvent) => {
			if (!field) return;
			const rect = field.getBoundingClientRect();
			brush.x = (e.clientX - rect.left) / rect.width;
			brush.y = 1 - (e.clientY - rect.top) / rect.height;
			brush.active = true;
		};
		field?.addEventListener('pointermove', disturb, { passive: true });

		const visible = new Set<Element>();
		const observer = new IntersectionObserver((entries) =>
			entries.forEach((entry) =>
				entry.isIntersecting ? visible.add(entry.target) : visible.delete(entry.target)
			)
		);
		observer.observe(hero);
		if (field) observer.observe(field);

		const mm = gsap.matchMedia();
		mm.add('(prefers-reduced-motion: no-preference)', () => {
			gsap.to(uniforms.uScroll, {
				value: 1,
				ease: 'none',
				scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true }
			});
			if (field) {
				gsap.to(fieldUniforms.uReveal, {
					value: 1,
					ease: 'none',
					scrollTrigger: { trigger: field, start: 'top bottom', end: 'top 20%', scrub: true }
				});
			}
		});

		const resize = () => {
			renderer.setSize(window.innerWidth, window.innerHeight);
			ScrollTrigger.refresh();
		};
		resize();
		window.addEventListener('resize', resize);

		let last = 0;
		const unsubscribe = onFrame((time) => {
			if (!visible.size) return;
			const delta = Math.min(time - last, 0.1);
			last = time;

			renderer.setScissorTest(false);
			renderer.setClearColor(0x000000, 0);
			renderer.clear();
			renderer.setScissorTest(true);

			for (const node of [hero, field]) {
				if (!node || !visible.has(node)) continue;
				const rect = node.getBoundingClientRect();
				const bottom = window.innerHeight - rect.bottom;
				renderer.setViewport(rect.left, bottom, rect.width, rect.height);
				renderer.setScissor(
					rect.left,
					Math.max(0, bottom),
					rect.width,
					Math.min(rect.height, window.innerHeight - Math.max(0, bottom))
				);

				if (node === hero) {
					camera.aspect = rect.width / rect.height;
					camera.position.z = 6 - uniforms.uScroll.value * 1.8;
					camera.updateProjectionMatrix();
					uniforms.uTime.value = time;
					uniforms.uPointer.value.lerp(cursor, 0.06);
					uniforms.uResolution.value.set(
						rect.width * renderer.getPixelRatio(),
						rect.height * renderer.getPixelRatio()
					);
					renderer.render(scene, camera);
				} else {
					fieldUniforms.uTime.value = time;
					fieldUniforms.uResolution.value.set(rect.width, rect.height);
					for (let i = 0; i < healing.length; i++) {
						healing[i] = Math.max(0, healing[i] - delta * 255);
						if (
							brush.active &&
							Math.hypot((i % 80) / 80 - brush.x, Math.floor(i / 80) / 40 - brush.y) < 0.08
						) {
							healing[i] = 255;
						}
					}
					brush.active = false;
					healingTexture.needsUpdate = true;
					renderer.render(fieldScene, fieldCamera);
				}
			}
		});

		hero.dataset.webgl = 'ready';
		const lost = (event: Event) => {
			event.preventDefault();
			delete hero.dataset.webgl;
		};
		element.addEventListener('webglcontextlost', lost);

		return () => {
			unsubscribe();
			observer.disconnect();
			mm.revert();
			window.removeEventListener('resize', resize);
			hero.removeEventListener('pointermove', move);
			field?.removeEventListener('pointermove', disturb);
			element.removeEventListener('webglcontextlost', lost);
			geo.dispose();
			plane.dispose();
			fieldGeo.dispose();
			material.dispose();
			fieldMaterial.dispose();
			glyphAtlas.dispose();
			textTexture.dispose();
			healingTexture.dispose();
			renderer.dispose();
			delete hero.dataset.webgl;
		};
	});
</script>

<canvas bind:this={canvas} class="procedural-canvas" aria-hidden="true"></canvas>

