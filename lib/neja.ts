export type {
	NinjaRule, //
} from "./build.ts"
export {
	allBuilds, //
	Build,
	rerun,
	RuleVar,
} from "./build.ts"

export {
	captureCurrentSourceDir, //
	maybeNejafile,
} from "./env.ts"

export type {
	Dir, //
	File,
	FileItem,
	FileItemOfType,
	FileItemType,
} from "./file.ts"
export {
	binRoot,
	buildRoot,
	currentSourceTree,
	currentOutTree,
	dir,
	file,
	fileItem,
	fileTree,
	outRoot,
	outTree,
	queryDir,
	queryFile,
	queryFileItem,
	sourceRoot,
	sourceTree,
} from "./file.ts"

export {
	flag, //
	resolveFlags,
	setFlags,
} from "./flag.ts"

export {
	mkdir, //
} from "./pipes/mkdir.ts"

export type {
	Path, //
	PathModifier,
	PathModifierFn,
	resolvePath_Args,
	resolvePath_CheckedArgs,
	resolvePath_UncheckedArgs,
} from "./path.ts"
export {
	expectRelativeDescendantPath, //
	isDescendant,
	isPathDirLike,
	normalizePath,
	parentPath,
	pathBasename,
	pathType,
	relativeDescendantPath,
	resolvePath,
} from "./path.ts"

export type {
	FilePipe, //
	FilePipeLike,
	OnFileItem,
} from "./pipe.ts"
export {
	pipe, //
} from "./pipe.ts"

export {
	importPipe as import, //
} from "./pipes/import.ts"

export type {
	FileArrayPipe, //
} from "./pipes/array.ts"
export {
	dirArray, //
	fileArray,
	fileItemArray,
} from "./pipes/array.ts"

export type {
	SingleFilePipe, //
} from "./pipes/single.ts"
export {
	singleDir, //
	singleFile,
	singleFileItem,
} from "./pipes/single.ts"

export {
	symlink, //
} from "./pipes/symlink.ts"

export {
	write, //
} from "./pipes/write.ts"

export {
	drainDiscoveryTasks, //
} from "./scheduling.ts"

export * as internal from "./internal.ts"