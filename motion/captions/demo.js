// Proof sheet: a dozen caption templates over a mid-grey 1080x1920 frame, clip 1 words, a few times.
//   node captions/demo.js [templateId,...]  -> out/stills/captions_demo.png
const fs = require("fs");
const path = require("path");
const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");
const CAPTIONS = require("./captions.js");
require("./fonts-node.js")(GlobalFonts);

CAPTIONS.load(JSON.parse(fs.readFileSync(path.join(__dirname, "templates.json"), "utf8")));
const words = JSON.parse(fs.readFileSync(path.join(__dirname, "words.json"), "utf8")).clip1;

const DEFAULT = ["professional", "bold", "karaoke", "billboard", "daybreak", "funky", "cut-out", "chat", "notification", "electric", "scribble", "spotlight", "half-half", "scrapbook", "hollow", "kinetic"];
const ids = process.argv[2] ? process.argv[2].split(",") : DEFAULT;
const TIMES = [ 0.9, 6.5, 12.3 ]; // seconds into clip 1
const W = 1080, H = 1920;
const cellW = 200, cellH = Math.round((cellW * H) / W), label = 22;
const cols = Math.min(8, Math.ceil(ids.length * TIMES.length / Math.ceil(ids.length * TIMES.length / 8)));
const perRow = 8, total = ids.length * TIMES.length;
const rows = Math.ceil(total / perRow);
const sheet = createCanvas(perRow * cellW, rows * (cellH + label));
const sx = sheet.getContext("2d");
sx.fillStyle = "#222"; sx.fillRect(0, 0, sheet.width, sheet.height);

const frame = createCanvas(W, H);
const ctx = frame.getContext("2d");
let k = 0;
for (const id of ids) {
  const values = CAPTIONS.resolve(id);
  const groups = CAPTIONS.groupWords(words, values);
  for (const t of TIMES) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#808080"; ctx.fillRect(0, 0, W, H);
    // a lighter band behind the caption area so outline and shadow read
    ctx.fillStyle = "#8c8c8c"; ctx.fillRect(0, H * 0.5, W, H * 0.5);
    // land mid-entrance for a few cells so entrances can be seen: use a time just after a group start
    CAPTIONS.draw(ctx, { W, H, t, groups, values, motion: "smooth" });
    const x = (k % perRow) * cellW, y = Math.floor(k / perRow) * (cellH + label);
    sx.drawImage(frame, x, y + label, cellW, cellH);
    sx.fillStyle = "#eee"; sx.font = "600 13px Inter";
    sx.fillText(id + " @" + t + "s", x + 6, y + 16);
    k++;
  }
}
const out = path.join(__dirname, "..", "out", "stills", "captions_demo.png");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, sheet.toBuffer("image/png"));
console.log(out, sheet.width + "x" + sheet.height);
