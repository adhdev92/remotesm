// Airtable Scripting smoke example.
// Pin the remotesm import to a commit SHA for long-lived/reproducible scripts.
const { RemoteEsmImport } = await import(
  "https://esm.sh/gh/adhdev92/remotesm@main?target=esnext&dev&standalone"
);

const pkg = await RemoteEsmImport("litdb@0.0.33", {
  log: false,
});

console.log("runtime exports", Object.keys(pkg.module));
console.log("manifest", {
  name: pkg.manifest?.name,
  version: pkg.manifest?.version,
  types: pkg.manifest?.types ?? pkg.manifest?.typings,
});
console.log("declaration files", pkg.declarations.files.map((file) => ({
  url: file.url,
  declarations: file.declarations.length,
})));
console.log("completion count", pkg.completions.flat.length);
