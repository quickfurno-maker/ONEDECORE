import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./test-stub-server-only-loader.mjs", pathToFileURL("./scripts/"));
