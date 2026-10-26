import test from "node:test";
import assert from "node:assert/strict";
import {
  BackSide,
  Color,
  DataTexture,
  MeshToonMaterial,
  NearestFilter,
  RedFormat,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
} from "three";
import {
  INK,
  toonRamp,
  RAMPS,
  cardTexture,
  cardMaterials,
  inkMaterial,
} from "../web3d/src/materials.js";

test("INK is a deep ink color string", () => {
  assert.equal(typeof INK, "string");
  assert.equal(INK, "#1d2433");
});

test("toonRamp produces a 1-pixel-tall RedFormat DataTexture with NearestFilter", () => {
  const levels = [0.82, 0.94, 1.0];
  const ramp = toonRamp(levels);
  assert.ok(ramp instanceof DataTexture);
  assert.equal(ramp.image.width, 3);
  assert.equal(ramp.image.height, 1);
  assert.equal(ramp.format, RedFormat);
  assert.equal(ramp.minFilter, NearestFilter);
  assert.equal(ramp.magFilter, NearestFilter);
  assert.equal(ramp.generateMipmaps, false);

  const bytes = Array.from(ramp.image.data);
  assert.deepEqual(bytes, [Math.round(0.82 * 255), Math.round(0.94 * 255), 255]);
});

test("RAMPS.card and RAMPS.table return ramps", () => {
  const cardRamp = RAMPS.card();
  assert.ok(cardRamp instanceof DataTexture);
  assert.equal(cardRamp.image.width, 3);

  const tableRamp = RAMPS.table();
  assert.ok(tableRamp instanceof DataTexture);
  assert.equal(tableRamp.image.width, 3);
});

test("cardTexture configures colorSpace, anisotropy and needsUpdate", () => {
  const tex = new Texture();
  const initialVersion = tex.version;
  const configured = cardTexture(tex, 4);
  assert.equal(configured, tex);
  assert.equal(tex.colorSpace, SRGBColorSpace);
  assert.equal(tex.anisotropy, 4);
  assert.ok(tex.version > initialVersion);
});

test("cardMaterials returns three MeshToonMaterials: face, back, and cream rim", () => {
  const face = new Texture();
  const back = new Texture();
  const ramp = RAMPS.card();
  const [mFace, mBack, mRim] = cardMaterials({ face, back, ramp });

  assert.ok(mFace instanceof MeshToonMaterial);
  assert.equal(mFace.map, face);
  assert.equal(mFace.gradientMap, ramp);

  assert.ok(mBack instanceof MeshToonMaterial);
  assert.equal(mBack.map, back);
  assert.equal(mBack.gradientMap, ramp);

  assert.ok(mRim instanceof MeshToonMaterial);
  assert.equal(mRim.color.getHexString().toLowerCase(), "f3efe6");
  assert.equal(mRim.gradientMap, ramp);
});

test("inkMaterial creates inverted hull outline ShaderMaterial", () => {
  const mat = inkMaterial({ color: "#ff0000", width: 3.5 });
  assert.ok(mat instanceof ShaderMaterial);
  assert.equal(mat.side, BackSide);
  assert.equal(mat.uniforms.inkColor.value.getHexString().toLowerCase(), "ff0000");
  assert.equal(mat.uniforms.inkWidth.value, 3.5);
  assert.ok(mat.uniforms.resolution.value);

  assert.ok(mat.vertexShader.includes("outlineNormal"));
  assert.ok(mat.vertexShader.includes("inkWidth"));
  assert.ok(mat.fragmentShader.includes("inkColor"));

  assert.equal(mat.polygonOffset, true);
  assert.equal(mat.polygonOffsetFactor, 1.0);
  assert.equal(mat.polygonOffsetUnits, 1.0);
  assert.ok(mat.vertexShader.includes("MAX_PUSH = 0.12"));
});
