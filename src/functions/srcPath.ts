import * as path from "path"
import { argv } from "../avian.lib"
/**
 * Srcs path
 * @param subdir 
 * @returns  
 */
export function srcPath(subdir: string) {
    return path.join(argv.name, subdir)
}
