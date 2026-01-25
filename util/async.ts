export function isPromiseLike(obj: unknown): obj is PromiseLike<unknown> {
	return (
		!!obj &&
		(typeof obj === "object" || typeof obj === "function") &&
		typeof (obj as { then?: unknown }).then === "function"
	)
}
