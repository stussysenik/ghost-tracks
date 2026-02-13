/**
 * Toast notification store using Svelte 5 runes.
 */
import type { Toast, ToastType } from '$types';

let toasts = $state<Toast[]>([]);
let counter = 0;

export function getToasts(): Toast[] {
	return toasts;
}

export function addToast(type: ToastType, message: string, duration = 4000): string {
	const id = `toast-${++counter}`;
	toasts = [...toasts, { id, type, message }];

	if (duration > 0) {
		setTimeout(() => removeToast(id), duration);
	}
	return id;
}

export function removeToast(id: string): void {
	toasts = toasts.filter((t) => t.id !== id);
}
