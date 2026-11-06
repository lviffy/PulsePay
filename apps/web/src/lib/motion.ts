import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

if (typeof window !== 'undefined') {
	gsap.registerPlugin(ScrollTrigger);
}

export const eases = { reveal: 'expo.out', scrub: 'power2.inOut', dock: 'back.out(1.15)' };
const alphabet = '01/{}[]<>_+*#';

if (typeof window !== 'undefined') {
	gsap.registerEffect({
		name: 'blur-in',
		effect: (targets: gsap.TweenTarget) =>
			gsap.fromTo(
				targets,
				{ opacity: 0, filter: 'blur(12px)', y: 12 },
				{ opacity: 1, filter: 'blur(0px)', y: 0, duration: 0.38, stagger: 0.005, ease: eases.reveal }
			),
		extendTimeline: true
	});

	gsap.registerEffect({
		name: 'row-enter',
		effect: (targets: gsap.TweenTarget) =>
			gsap.from(targets, { opacity: 0, y: 8, duration: 0.35, stagger: 0.035, ease: eases.reveal }),
		extendTimeline: true
	});

	gsap.registerEffect({
		name: 'decode',
		effect: (targets: Element[]) => {
			const timeline = gsap.timeline();
			targets.forEach((el, index) => {
				const original = el.textContent || '';
				const state = { progress: 0 };
				timeline.to(
					state,
					{
						progress: 1,
						duration: 0.35,
						onUpdate: () => {
							el.textContent =
								state.progress > 0.8
									? original
									: alphabet[Math.floor(Math.random() * alphabet.length)];
						},
						onComplete: () => {
							el.textContent = original;
						}
					},
					index * 0.018
				);
			});
			return timeline;
		},
		extendTimeline: true
	});
}

type Frame = (seconds: number) => void;
const subscribers = new Set<Frame>();

export function onFrame(frame: Frame) {
	subscribers.add(frame);
	return () => {
		subscribers.delete(frame);
	};
}

let lenisInstance: Lenis | undefined;

export function scrollPageBy(delta: number) {
	if (lenisInstance) {
		lenisInstance.scrollTo(lenisInstance.targetScroll + delta, { programmatic: false });
	} else {
		window.scrollBy({ top: delta, behavior: 'instant' });
	}
}

export function initMotion(pathname: string) {
	if (typeof window === 'undefined') return () => {};

	const media = gsap.matchMedia();
	media.add(
		{
			animated: '(prefers-reduced-motion: no-preference)',
			desktop: '(min-width: 900px)',
			mobile: '(max-width: 899px)'
		},
		(context) => {
			if (context.conditions?.animated && !pathname.startsWith('/merchant')) {
				lenisInstance = new Lenis({
					autoRaf: false,
					duration: 1.05,
					anchors: true,
					prevent: (node) => node.hasAttribute('data-lenis-prevent')
				});
				lenisInstance.on('scroll', ScrollTrigger.update);
			}
			return () => {
				lenisInstance?.destroy();
				lenisInstance = undefined;
			};
		}
	);

	const tick = (time: number) => {
		lenisInstance?.raf(time * 1000);
		if (!document.hidden) subscribers.forEach((frame) => frame(time));
	};

	gsap.ticker.lagSmoothing(0);
	gsap.ticker.add(tick);
	document.fonts.ready.then(() => ScrollTrigger.refresh());

	return () => {
		media.revert();
		gsap.ticker.remove(tick);
	};
}

export { gsap, ScrollTrigger };

