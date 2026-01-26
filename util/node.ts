import * as fs from "fs"
import * as path from "path"

/**
 * Submit a chunk for writing, ensuring backpressure is handled.
 *
 * The returned promise resolves when the chunk has been successfully received
 * by the stream, but does not indicate anything about whether it has been
 * flushed to the underlying resource.
 */
export async function WriteStream_submit(out: fs.WriteStream, chunk: string): Promise<void> {
	if (!out.write(chunk)) {
		return new Promise((resolve, reject) => {
			out.once("drain", resolve)
			out.once("error", reject)
		})
	}
}

/**
 * Get the stack trace of the current call site as an array of {@link NodeJS.CallSite}, as opposed
 * to {@link Error.captureStackTrace} which only provides a string.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export function Error_captureStructuredStackTrace(constructorOpt?: Function): NodeJS.CallSite[] {
	if (!("prepareStackTrace" in (Error as object)) || !("captureStackTrace" in (Error as object))) {
		throw new Error("captureStackTrace() is not supported in this environment.")
	}

	// let stack: string | undefined

	let evaluatedStack: unknown
	let capturedTrace: NodeJS.CallSite[] | null = null

	// eslint-disable-next-line @typescript-eslint/unbound-method
	const prepareStackTrace_orig = Error.prepareStackTrace
	try {
		const targetObject: { stack?: unknown } = {}
		Error.prepareStackTrace = (_, trace) => {
			capturedTrace = trace
			return "Error_captureStructuredStackTrace"
		}
		Error.captureStackTrace(targetObject, constructorOpt)
		// Evaluation happens in the getter of the `stack` property.
		evaluatedStack = targetObject.stack
	} finally {
		Error.prepareStackTrace = prepareStackTrace_orig
	}

	// Include `evaluatedStack` in the condition to ensure it won't be optimized out.
	if (!capturedTrace || !evaluatedStack) {
		throw new Error("Failed to capture structured stack trace.")
	}

	// V8 specs says it's safe to keep the captured reference and use it as a return value.
	return capturedTrace
}

const DOT_DOT_SEP_PATH = ".." + path.sep

/** When {@link to} is a child of {@link from}, compute its relative path. Otherwise `null`. */
export function path_nestedRelative(from: string, to: string): string | null {
	const rel = path.relative(from, to)
	const isNested = rel !== ".." && !rel.startsWith(DOT_DOT_SEP_PATH) && !path.isAbsolute(rel)
	return isNested ? rel : null
}
