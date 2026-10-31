// Registers Animora's bundled caption fonts (captions/fonts/*.woff2) with @napi-rs/canvas under
// the family names captions.js asks for. Usage: require("./captions/fonts-node.js")();
const path = require("path");
const fs = require("fs");
const CAPTIONS = require("./captions.js");

let done = false;
module.exports = function registerCaptionFonts(GlobalFonts) {
  if (done) return CAPTIONS.faces.length;
  GlobalFonts = GlobalFonts || require("@napi-rs/canvas").GlobalFonts;
  let n = 0;
  for (const f of CAPTIONS.faces) {
    const file = path.join(__dirname, "fonts", f.file);
    if (!fs.existsSync(file)) { console.warn("caption font missing:", f.file); continue; }
    if (GlobalFonts.registerFromPath(file, f.family)) n++;
  }
  done = true;
  return n;
};
