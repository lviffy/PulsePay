<script lang="ts">
	import { onMount } from 'svelte';
	import { onFrame } from '$lib/motion';

	interface Props {
		mini?: boolean;
	}
	let { mini = false }: Props = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);

	onMount(() => {
		if (!canvas) return;
		const node = canvas;
		const ctx = node.getContext('2d');
		if (!ctx) return;

		let visible = true;
		const observer = new IntersectionObserver(([entry]) => {
			visible = entry.isIntersecting;
			if (visible) draw(lastTime);
		});
		observer.observe(node);

		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		let width = 0;
		let height = 0;
		let lastTime = 0;

		const draw = (time: number) => {
			if (!visible) return;
			lastTime = time;
			const w = width;
			const h = height;
			ctx.clearRect(0, 0, w, h);
			ctx.strokeStyle = mini ? '#78786f' : '#c1c0b5';
			ctx.lineWidth = 1;

			const join = w * 0.68;
			for (let lane = 0; lane < 5; lane++) {
				const y = h * (0.12 + lane * 0.19);
				ctx.beginPath();
				ctx.moveTo(0, y);
				ctx.bezierCurveTo(w * 0.3, y, w * 0.46, h / 2, join, h / 2);
				ctx.stroke();

				for (let i = 0; i < (mini ? 4 : 6); i++) {
					const t = ((reduced ? 0 : time * 0.065) + i / (mini ? 4 : 6) + lane * 0.047) % 1;
					const u = 1 - t;
					// Use the same cubic as the rail so each particle stays on its path.
					const x = 3 * u * u * t * w * 0.3 + 3 * u * t * t * w * 0.46 + t * t * t * join;
					const py = (u * u * u + 3 * u * u * t) * y + (3 * u * t * t + t * t * t) * h / 2;
					ctx.fillStyle = mini ? '#d8d5c8' : '#20201e';
					ctx.beginPath();
					ctx.arc(x, py, mini ? 1 : 2.5, 0, Math.PI * 2);
					ctx.fill();
				}
			}
			ctx.beginPath();
			ctx.moveTo(join, h / 2);
			ctx.lineTo(w, h / 2);
			ctx.stroke();
			ctx.fillStyle = '#f27b25';
			for (let i = 0; i < (mini ? 4 : 8); i++) {
				const p = ((reduced ? 0 : time * 0.14) + i / (mini ? 4 : 8)) % 1;
				ctx.beginPath();
				ctx.arc(join + p * (w - join), h / 2, mini ? 1 : 2.5, 0, Math.PI * 2);
				ctx.fill();
			}
		};

		const resize = new ResizeObserver(([entry]) => {
			width = entry.contentRect.width;
			height = entry.contentRect.height;
			const dpr = Math.min(window.devicePixelRatio || 1, 2);
			node.width = Math.round(width * dpr);
			node.height = Math.round(height * dpr);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			draw(lastTime);
		});
		resize.observe(node);
		const stop = reduced ? () => {} : onFrame(draw);

		return () => {
			stop();
			observer.disconnect();
			resize.disconnect();
		};
	});
</script>

<canvas
	bind:this={canvas}
	width={mini ? 160 : 1000}
	height={mini ? 70 : 300}
	class={mini ? 'minimap-flow' : 'token-flow'}
	aria-hidden="true"
></canvas>

