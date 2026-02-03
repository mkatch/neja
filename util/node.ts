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

/**
 * Check whether a file or directory exists at the given path.
 *
 * If the path points to a symbolic link, checks the existence of the link itself, not its target.
 */
export async function fs_exists(filePath: string): Promise<boolean> {
	try {
		await fs.promises.lstat(filePath)
		return true
	} catch {
		return false
	}
}

/**
 * Create a directory at the specified path.
 *
 * @param throwIfExists If true, throw an error if any entity already exists at the path. Note that even setting to false, it will still throw if the existing entity is not a directory. Default: true.
 * @param recursive If true, recursively create parent directories if they do not exist. Also prevents throwing if the directory already exists, regardless of `throwIfExists`. Default: false.
 */
export async function fs_mkdir(
	dirPath: string,
	params?: {
		throwIfExists?: boolean
		recursive?: boolean
	},
): Promise<void> {
	const { recursive = false, throwIfExists = true } = params || {}
	try {
		await fs.promises.mkdir(dirPath, { recursive })
	} catch (e) {
		if (!throwIfExists && (e as NodeJS.ErrnoException).code === "EEXIST") {
			const stat = await fs.promises.lstat(dirPath)
			if (stat.isDirectory()) {
				return
			}
		}
		throw e
	}
}

/**
 * Create a symbolic link at {@link link} pointing to {@link target}.
 *
 * @param recursivelyCreateDirs If true, recursively create parent directories of {@link link} if they do not exist. Default: false.
 * @param overrideIfExistsAsLink If true, and if {@link link} already exists as a symbolic link, override it. Default: false.
 */
export async function fs_symlink(
	target: string,
	link: string,
	params?: {
		type?: fs.symlink.Type
		recursivelyCreateDirs?: boolean
		overrideIfExistsAsLink?: boolean
	},
): Promise<void> {
	const { recursivelyCreateDirs = false, overrideIfExistsAsLink = false, type } = params || {}
	if (recursivelyCreateDirs) {
		const dirPath = path.dirname(link)
		await fs.promises.mkdir(dirPath, { recursive: true })
	}
	try {
		await fs.promises.symlink(target, link, type)
	} catch (e) {
		if (overrideIfExistsAsLink && (e as NodeJS.ErrnoException).code === "EEXIST") {
			const stat = await fs.promises.lstat(link)
			if (stat.isSymbolicLink()) {
				await fs.promises.unlink(link)
				await fs.promises.symlink(target, link, type)
				return
			}
		}
		throw e
	}
}
