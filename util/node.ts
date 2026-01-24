import * as fs from "fs"

export async function WriteStream_safeWrite(out: fs.WriteStream, chunk: string): Promise<void> {
	if (!out.write(chunk)) {
		return new Promise((resolve, reject) => {
			out.once("drain", resolve)
			out.once("error", reject)
		})
	}
}
