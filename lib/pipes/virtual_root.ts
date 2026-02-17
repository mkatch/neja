import { Dir_promoteToVirtualRoot, type FileItem } from "../file";
import type { FilePipe } from "../pipe";

export const virtualRoot: FilePipe = {
  onFileItem(item: FileItem): void {
    if (item.type !== "dir") {
      throw new Error(`Only directories can be virtual roots, got: ${item}`);
    }
    Dir_promoteToVirtualRoot(item)
  }
}