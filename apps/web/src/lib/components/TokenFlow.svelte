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
		});
		observer.observe(node);

		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		const draw = (time: number) => {
			if (!visible) return;
			const w = node.width;
			const h = node.height;
			ctx.clearRect(0, 0, w, h);
			ctx.strokeStyle = mini ? '#78786f' : '#c1c0b5';
			ctx.lineWidth = 1;

			for (let lane = 0; lane < 5; lane++) {
				const y = h * (0.14 + lane * 0.18);
				ctx.beginPath();
				ctx.moveTo(0, y);
				ctx.bezierCurveTo(w * 0.35, y, w * 0.5, h / 2, w * 0.72, h / 2);
				ctx.lineTo(w, h / 2);
				ctx.stroke();

				for (let i = 0; i < 12; i++) {
					const p = ((reduced ? 0 : time * 0.045) + i / 12 + lane * 0.047) % 1;
					const x = p * w;
					const t = Math.min(1, p / 0.72);
					const smooth = t * t * (3 - 2 * t);
					const py = y + (h / 2 - y) * smooth;
					ctx.fillStyle = p > 0.72 ? '#f27b25' : mini ? '#d8d5c8' : '#20201e';
					ctx.fillRect(x, py, mini ? 2 : 3, mini ? 2 : 3);
				}
			}
		};

		draw(0);
		const stop = reduced ? () => {} : onFrame(draw);

		return () => {
			stop();
			observer.disconnect();
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

