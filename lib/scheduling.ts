const pendingDiscoveryTasks = new Array<PromiseLike<unknown>>()

export async function drainDiscoveryTasks(): Promise<void> {
	while (pendingDiscoveryTasks.length > 0) {
		const batch = pendingDiscoveryTasks.splice(0)
		await Promise.all(batch)
	}
}

export function addDiscoveryTask(task: PromiseLike<unknown>): void {
	pendingDiscoveryTasks.push(task)
}
