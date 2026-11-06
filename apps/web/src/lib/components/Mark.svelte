<script lang="ts">
	interface Props {
		class?: string;
	}
	let { class: className = '' }: Props = $props();

	const points = Array.from({ length: 25 }, (_, i) => {
		const x = 2 + i * 1.25;
		const envelope = Math.exp(-Math.pow((i - 12) / 5, 2));
		return `${x},${17 + (Math.sin(i * 1.48) * 12 + Math.sin(i * 127.1) * 0.5 * 4) * envelope}`;
	}).join(' ');
</script>

<svg class="mark {className}" viewBox="0 0 34 34" fill="none" aria-hidden="true">
	<rect x=".5" y=".5" width="33" height="33" rx="4" stroke="currentColor" />
	<polyline {points} stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
</svg>

