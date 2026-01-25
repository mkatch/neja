export function isPromiseLike(obj: any): obj is PromiseLike<unknown> {
	return (
		!!obj &&
		(typeof obj === "object" || typeof obj === "function") &&
		typeof obj.then === "function"
	)
}
