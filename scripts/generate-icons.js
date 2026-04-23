const { createCanvas } = require("canvas");
const fs = require("fs");
const path = require("path");

const sizes = [16, 32, 64, 80];

function drawSnowflakeIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#29B5E8";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;

  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = size * 0.09;
  ctx.lineCap = "round";

  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
    ctx.stroke();

    const bx = cx + r * 0.55 * Math.cos(angle);
    const by = cy + r * 0.55 * Math.sin(angle);
    const bl = size * 0.13;
    ctx.beginPath();
    ctx.moveTo(bx + bl * Math.cos(angle + Math.PI / 2), by + bl * Math.sin(angle + Math.PI / 2));
    ctx.lineTo(bx - bl * Math.cos(angle + Math.PI / 2), by - bl * Math.sin(angle + Math.PI / 2));
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.08, 0, Math.PI * 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();

  return canvas.toBuffer("image/png");
}

sizes.forEach((size) => {
  const buf = drawSnowflakeIcon(size);
  const outPath = path.join(__dirname, `../assets/icon-${size}.png`);
  fs.writeFileSync(outPath, buf);
  console.log(`Created icon-${size}.png`);
});
