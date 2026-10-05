import { PRODUCT } from "@structsmith/contracts";
import { localHelp, parseLocalOptions, runLocal } from "./launcher";

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) console.log(localHelp);
else if (args.includes("--version")) console.log(PRODUCT.version);
else {
  try {
    await runLocal(parseLocalOptions(args));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Unable to start StructSmith local.");
    process.exitCode = 1;
  }
}

// Profile cleanup and final chat writes have completed. Bun HTTP connection pools
// may outlive their requests; a standalone CLI must return control to the terminal.
process.exit(process.exitCode === 1 ? 1 : 0);
