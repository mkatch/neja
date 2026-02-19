import { RuleVar } from "../rule"
import type { FilePipe } from "../pipe"

export function ninjaVar(name: string, params?: { overwrite?: boolean }): FilePipe {
  const { overwrite = false } = params ?? {}

  return {
    onFileItem(item): void {
      if (!overwrite && item.ninjaVar) {
        throw new Error(`File item ${item} already has a ninja variable "${item.ninjaVar}", cannot assign "${name}"`)
      }
      item.ninjaVar = new RuleVar(name)
    }
  }
}