import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

import protobuf from 'protobufjs'

const schema = `
syntax = "proto3";
message MovieEntity {
  string version = 1;
  MovieParams params = 2;
  map<string, bytes> images = 3;
  repeated SpriteEntity sprites = 4;
  repeated AudioEntity audios = 5;
}
message MovieParams {
  float viewBoxWidth = 1;
  float viewBoxHeight = 2;
  int32 fps = 3;
  int32 frames = 4;
}
message SpriteEntity {
  string imageKey = 1;
  repeated FrameEntity frames = 2;
  string matteKey = 3;
}
message FrameEntity {
  float alpha = 1;
  Layout layout = 2;
  Transform transform = 3;
  string clipPath = 4;
  repeated ShapeEntity shapes = 5;
}
message Layout {
  float x = 1;
  float y = 2;
  float width = 3;
  float height = 4;
}
message Transform {
  float a = 1;
  float b = 2;
  float c = 3;
  float d = 4;
  float tx = 5;
  float ty = 6;
}
message ShapeEntity {
  ShapeType type = 1;
  ShapeArgs shape = 2;
  RectArgs rect = 3;
  EllipseArgs ellipse = 4;
  ShapeStyle styles = 10;
  Transform transform = 11;
}
enum ShapeType {
  SHAPE = 0;
  RECT = 1;
  ELLIPSE = 2;
  KEEP = 3;
}
message ShapeArgs {
  string d = 1;
}
message RectArgs {
  float x = 1;
  float y = 2;
  float width = 3;
  float height = 4;
  float cornerRadius = 5;
}
message EllipseArgs {
  float x = 1;
  float y = 2;
  float radiusX = 3;
  float radiusY = 4;
}
message ShapeStyle {
  RGBAColor fill = 1;
  RGBAColor stroke = 2;
  float strokeWidth = 3;
  LineCap lineCap = 4;
  LineJoin lineJoin = 5;
  float miterLimit = 6;
  float lineDashI = 7;
  float lineDashII = 8;
  float lineDashIII = 9;
}
message RGBAColor {
  float r = 1;
  float g = 2;
  float b = 3;
  float a = 4;
}
enum LineCap {
  LineCap_BUTT = 0;
  LineCap_ROUND = 1;
  LineCap_SQUARE = 2;
}
enum LineJoin {
  LineJoin_MITER = 0;
  LineJoin_ROUND = 1;
  LineJoin_BEVEL = 2;
}
message AudioEntity {
  string audioKey = 1;
  int32 startFrame = 2;
  int32 endFrame = 3;
  int32 startTime = 4;
  int32 totalTime = 5;
}`

const [input, output] = process.argv.slice(2)

if (!input || !output) {
	process.stderr.write(
		'Usage: node extract-svga-frames.mjs <input.bin> <output-dir>\n',
	)
	process.exit(1)
}

const root = protobuf.parse(schema).root
const MovieEntity = root.lookupType('MovieEntity')
const inflated = zlib.inflateSync(fs.readFileSync(input))
const movie = MovieEntity.toObject(MovieEntity.decode(inflated), {
	bytes: Buffer,
	defaults: true,
})

fs.mkdirSync(output, { recursive: true })

for (const sprite of movie.sprites) {
	const image = movie.images[sprite.imageKey]
	if (!image) continue

	for (const [frameIndex, frame] of sprite.frames.entries()) {
		if (!frame.alpha || !frame.layout) continue

		const fileName = `frame_${String(frameIndex).padStart(3, '0')}.png`
		const framePath = path.join(output, fileName)

		// This Bilibili thumb-up asset is already flattened into one full-canvas
		// PNG per active frame, so the extraction path can keep the image bytes.
		// General SVGA compositing can be added here when a skin ships layered
		// frames with non-null transforms or partial layouts.
		fs.writeFileSync(framePath, image)
	}
}

fs.writeFileSync(
	path.join(output, 'manifest.json'),
	JSON.stringify(
		{
			version: movie.version,
			width: movie.params.viewBoxWidth,
			height: movie.params.viewBoxHeight,
			fps: movie.params.fps,
			frames: movie.params.frames,
		},
		null,
		2,
	),
)
