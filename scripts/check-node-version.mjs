const [major, minor] = process.versions.node.split(".").map(Number);

if (major < 24 || (major === 24 && minor < 12)) {
  console.error(
    `EstateOS requires Node.js 24.12 or later. Detected ${process.version}. ` +
      "Switch to Node 24.12+ (see .nvmrc) and restart the command.",
  );
  process.exit(1);
}
