import { isPromiseLike } from "@util/async.ts"

const discoveryTasks = new Array<PromiseLike<unknown>>()

export async function drainDiscoveryTasks(): Promise<void> {
	while (discoveryTasks.length > 0) {
		const batch = discoveryTasks.splice(0)
		await Promise.all(batch)
	}
}

export function addDiscoveryTaskIfPromise(task: unknown): void {
	if (isPromiseLike(task)) {
		discoveryTasks.push(task)
	}
}
