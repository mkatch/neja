export {
	type FileItem,
	type FileItemPipe,
	//
	Dir,
	File,
	FileItemArray,
	SingleFileItemPipe,
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

export {
	type NinjaRule,
	//
	Build,
	RuleVar,
	//
	allBuilds,
} from "./build.ts"

export { config, captureCurrentSourceDir } from "./env.ts"

export { resolveFlags, flag, setFlags } from "./flag.ts"

export { drainDiscoveryTasks } from "./scheduling.ts"
