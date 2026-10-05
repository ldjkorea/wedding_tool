import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import fs from 'node:fs';

// Prefer project tooling; reuse Codex's installed test tooling when available.
// CI can set FLOW_TEST_NODE_MODULES, or install these test-only tools normally.
const require = createRequire(import.meta.url);
export function testTool(name: string): any {
  try { return require(name); } catch (error) {
    const modules = process.env.FLOW_TEST_NODE_MODULES || path.join(os.homedir(), '.cache',
      'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules');
    if (!fs.existsSync(path.join(modules, name))) throw new Error('Missing test tool ' + name + '. Set FLOW_TEST_NODE_MODULES to installed playwright/pdf-lib/pngjs packages.', { cause: error });
    return require(path.join(modules, name));
  }
}
export interface RasterCapture { png: string; text: string; width: number; height: number }

// Undo PNG row prediction in a PDF image stream. The real generator embeds RGB,
// 8-bit FlateDecode images with PNG predictors. Reject other encodings explicitly.
function unfilter(raw: Uint8Array, width: number, height: number, predictor: number): Buffer {
  const stride = width * 3;
  if (predictor === 1) {
    assert.equal(raw.length, stride * height);
    return Buffer.from(raw);
  }
  assert.ok(predictor >= 10 && predictor <= 15);
  assert.equal(raw.length, (stride + 1) * height);
  const result = Buffer.alloc(stride * height);
  for (let row = 0; row < height; row++) {
    const filter = raw[row * (stride + 1)];
    assert.ok(filter <= 4);
    for (let col = 0; col < stride; col++) {
      const index = row * stride + col;
      const left = col >= 3 ? result[index - 3] : 0;
      const up = row > 0 ? result[index - stride] : 0;
      const diagonal = row > 0 && col >= 3 ? result[index - stride - 3] : 0;
      let correction = 0;
      if (filter === 1) correction = left;
      if (filter === 2) correction = up;
      if (filter === 3) correction = Math.floor((left + up) / 2);
      if (filter === 4) {
        const p = left + up - diagonal, a = Math.abs(p - left), b = Math.abs(p - up), c = Math.abs(p - diagonal);
        correction = a <= b && a <= c ? left : b <= c ? up : diagonal;
      }
      result[index] = (raw[row * (stride + 1) + 1 + col] + correction) & 255;
    }
  }
  return result;
}

/** Compare actual PDF page image pixels to real html2canvas output. No OCR,
 * synthetic canvas or fake PDF generator is used. DOM assertions establish
 * which product was captured; this establishes the PDF contains that capture. */
export async function assertRasterPdf(bytes: Buffer, captures: RasterCapture[], number: string, hash: string) {
  const { PDFDocument, PDFName, PDFRawStream, PDFArray, decodePDFRawStream } = testTool('pdf-lib');
  const { PNG } = testTool('pngjs');
  const document = await PDFDocument.load(bytes);
  assert.equal(document.getTitle(), number);
  assert.equal(document.getSubject(), 'contract-snapshot:' + hash);
  assert.ok(captures.length >= 2);
  assert.equal(document.getPageCount(), captures.length);
  for (const [i, page] of document.getPages().entries()) {
    const contents = page.node.Contents();
    const streams = contents instanceof PDFArray ? contents.asArray().map((ref: any) => document.context.lookup(ref)) : [contents];
    const commands = streams.map((stream: any) => Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1')).join('\n');
    const imageName = commands.match(/\/(I\d+)\s+Do/);
    assert.ok(imageName, 'Every PDF page must draw its captured image');
    const resources = page.node.Resources().lookup(PDFName.of('XObject'));
    const image = document.context.lookup(resources.get(PDFName.of(imageName[1])));
    assert.ok(image instanceof PDFRawStream);
    const numberValue = (key: string) => image.dict.lookup(PDFName.of(key)).asNumber();
    const width = numberValue('Width'), height = numberValue('Height');
    assert.equal(width, captures[i].width); assert.equal(height, captures[i].height);
    assert.equal(numberValue('BitsPerComponent'), 8);
    assert.equal(image.dict.lookup(PDFName.of('ColorSpace')).toString(), '/DeviceRGB');
    const params = image.dict.lookup(PDFName.of('DecodeParms'));
    const predictor = params ? params.lookup(PDFName.of('Predictor')).asNumber() : 1;
    const actual = unfilter(decodePDFRawStream(image).decode(), width, height, predictor);
    const png = PNG.sync.read(Buffer.from(captures[i].png.split(',')[1], 'base64'));
    assert.equal(png.width, width); assert.equal(png.height, height);
    const expected = Buffer.alloc(width * height * 3);
    for (let j = 0; j < width * height; j++) {
      assert.equal(png.data[j * 4 + 3], 255, 'Opaque page capture required');
      expected[j * 3] = png.data[j * 4]; expected[j * 3 + 1] = png.data[j * 4 + 1]; expected[j * 3 + 2] = png.data[j * 4 + 2];
    }
    // Hashes keep assertion output small; equality covers every RGB byte.
    const { createHash } = await import('node:crypto');
    assert.equal(createHash('sha256').update(actual).digest('hex'), createHash('sha256').update(expected).digest('hex'), 'PDF page ' + (i + 1) + ' differs from captured contract document');
  }
  return document.getPageCount();
}
