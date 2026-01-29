export {
	type FileItem,
	type FileItemPipe,
	//
	Dir,
	File,
	FileItemArray,
	//
	buildCounterpart,
	buildFile,
	buildTree,
	dir,
	file,
	fileTree,
	imported,
	queryDir,
	queryDirNaive,
	queryFile,
	queryFileItem,
	queryFileItemNaive,
	queryFileNaive,
	sourceTree,
} from "./file.ts"

export { Build } from "./build.ts"

export { captureCurrentSourceDir } from "./env.ts"

export { resolveFlags, flag, setFlags } from "./flag.ts"
