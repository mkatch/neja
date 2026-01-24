export function Array_sortAndRemoveDuplicates<T>(arr: T[]): void {
	if (arr.length === 0) {
		return
	}
	arr.sort()
	let distinctCount = 1
	for (let i = 1; i < arr.length; ++i) {
		if (arr[i] !== arr[i - 1]) {
			arr[distinctCount++] = arr[i]
		}
	}
	arr.length = distinctCount
}
