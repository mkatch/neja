import * as fs from "fs"

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
