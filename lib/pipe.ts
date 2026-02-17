import type { FileItem } from "./file"
import { FileItem_addTask } from "./file"

/**
 * An interface for objects receiving {@link FileItem}s, called "pipes".
 *
 * It is part of a broader convention for structuring your neja build files in which the statements
 * begin by declaring a file or a directory (a {@link FileItem}), and then applying a sequence of
 * operations ({@link FilePipe}s) to it.
 *
 * The pipes can implement pretty much any logic. Typical use cases include:
 *   * Mark file as a dependency or product of a build step.
 *   * Declare additional related files (e.g. a C++ header .h file to a source .cpp file).
 *   * Annotate the file with metadata.
 *
 * Some helpful built-in pipes include:
 *   * TODO
 *
 * You can invoke a pipe in two ways. The first way is manually calling {@link pipe}:
 *
 * ```ts
 * const index = neja.singleFile()
 * neja.pipe(neja.file("index.ts"), index)
 * console.log(index.item) // prints the FileItem for "index.ts"
 * ```
 *
 * But usually you want to handle
 *
 * ```ts
 *	const sources = neja.fileArray()
 *	neja.sourceTree({
 *		"main.cpp": sources,
 *		"util.cpp": sources,
 *	})
 *	console.log(sources.items) // prints the FileItem-s for "main.cpp" and "util.cpp"
 * ```
 *
 * Don't call the {@link onFileItem} method directly as it circumvents some important mechanisms.
 * Most importantly, if the result of a pipe is a promise, it will be added to
 * {@link FileItem.pendingTasks}. If multiple pipes are applied to he same item, they are always
 * queued into that list, so that even async pipes execute in sequence. Pipes applied to different
 * files are independent and don't await each other.
 *
 * {@link FilePipe} is the canonical interface for pipes, but for practical purposes, wherever you
 * can use a {@link FilePipe}, you can also use some ad-hoc constructs that are functionally
 * equivalent. See {@link FilePipeLike}.
 */
export interface FilePipe {
	onFileItem: OnFileItem
}

/**
 * A bare function equivalent to a {@link FilePipe}.
 *
 * See {@link FilePipeLike}
 */
export type OnFileItem<T extends FileItem = FileItem> = (item: T) => void | Promise<void>

/**
 * A broader type that is functionally equivalent to {@link FilePipe} but also admits some
 * ad-hoc constructs.
 *
 * A bare {@link OnFileItem} function is treated as a pipe with that function as its
 * {@link FilePipe.onFileItem} handler. In other words
 *
 * ```ts
 * neja.pipe(item, (item) => { ... })
 * ```
 *
 * is the same as
 *
 * ```ts
 * neja.pipe(item, { onFileItem: (item) => { ... } })
 * ```
 *
 * An array of pipes is treated as a pipe that applies each of the pipes in a sequence.
 *
 * ```ts
 * neja.pipe(item, [pipe1, pipe2, pipe3])
 * ```
 *
 * is the same as
 *
 * ```ts
 *	neja.pipe(item, {
 *		onFileItem: (item) => {
 *			neja.pipe(item, pipe1)
 *			neja.pipe(item, pipe2)
 *			neja.pipe(item, pipe3)
 *		}
 *	})
 * ```
 *
 * When implementing your own utilities for pipes, consider accepting a {@link FilePipeLike} instead of a {@link FilePipe} for maximum flexibility.
 */
export type FilePipeLike = FilePipe | OnFileItem | FilePipeLike[]

/**
 * Pass a {@link FileItem} to a {@link FilePipeLike}.
 *
 * Don't just call the {@link FilePipe.onFileItem} method directly, as that circumvents some
 * important mechanisms (see {@link FilePipe}).
 */
export function pipe<F extends FileItem>(item: F, pipe: FilePipeLike): F {
	pipe_aux(item, pipe)
	return item
}

function pipe_aux(item: FileItem, pipe: FilePipeLike): void {
	if (typeof pipe === "function") {
		FileItem_addTask(item, pipe)
	} else if ("onFileItem" in pipe) {
		FileItem_addTask(item, pipe.onFileItem.bind(pipe))
	} else {
		// Gotcha: one might be tempted to change order and check `Array.isArray` first instead of
		// `"onFileItem" in pipe`. But that would incorrectly classify objects that are _simultaneously_
		// `Array`s and `FilePipe`s.
		for (const sub of pipe) {
			pipe_aux(item, sub)
		}
	}
}
