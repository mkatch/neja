export class UniqueNameResolver {
	conflicts = new Map<string, { nextIndex: number }>()

	claim(baseName: string): string {
		let name = baseName
		const conflict = this.conflicts.get(name)
		if (conflict) {
			do {
				name = `${baseName}_${conflict.nextIndex}`
				conflict.nextIndex += 1
			} while (this.conflicts.has(name))
		} else {
			this.conflicts.set(name, { nextIndex: 1 })
		}
		return name
	}
}
