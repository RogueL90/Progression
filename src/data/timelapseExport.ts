import {
  AlphaType,
  ColorType,
  FilterMode,
  MipmapMode,
  Skia,
} from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import { GIFEncoder, applyPalette, quantize } from 'gifenc';

import { PROGRESSION_ROOT_DIR } from '@/constants/storage';
import type { ProgressPhoto } from '@/types/photo';
import { getErrorMessage } from '@/utils/errors';
import {
  EXPORTS_DIR,
  ensureExportDirectory,
  readFileBytes,
} from '@/utils/file';

const MAX_EXPORT_WIDTH = 720;
const MAX_PALETTE_COLORS = 256;

export type TimelapseExportProgress = {
  current: number;
  total: number;
};

type CreateTimelapseExportOptions = {
  frames: ProgressPhoto[];
  intervalMs: number;
  onProgress?: (progress: TimelapseExportProgress) => void;
};

function fitContain(
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number
): { x: number; y: number; width: number; height: number } {
  const scale = Math.min(dstWidth / srcWidth, dstHeight / srcHeight);
  const width = srcWidth * scale;
  const height = srcHeight * scale;
  return {
    x: (dstWidth - width) / 2,
    y: (dstHeight - height) / 2,
    width,
    height,
  };
}

function getOutputSize(
  srcWidth: number,
  srcHeight: number
): {
  width: number;
  height: number;
} {
  if (srcWidth <= 0 || srcHeight <= 0) {
    return { width: MAX_EXPORT_WIDTH, height: MAX_EXPORT_WIDTH };
  }

  if (srcWidth <= MAX_EXPORT_WIDTH) {
    return {
      width: Math.max(1, Math.round(srcWidth)),
      height: Math.max(1, Math.round(srcHeight)),
    };
  }

  const scale = MAX_EXPORT_WIDTH / srcWidth;
  return {
    width: MAX_EXPORT_WIDTH,
    height: Math.max(1, Math.round(srcHeight * scale)),
  };
}

function delayCentiseconds(intervalMs: number): number {
  return Math.max(2, Math.min(65535, Math.round(intervalMs / 10)));
}

async function yieldToUi(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function loadSkiaImage(bytes: Uint8Array) {
  const data = Skia.Data.fromBytes(bytes);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) {
    throw new Error('Could not decode one of the progress photos.');
  }
  return image;
}

function renderFramePixels(
  image: ReturnType<typeof loadSkiaImage>,
  width: number,
  height: number
): Uint8Array {
  const surface = Skia.Surface.MakeOffscreen(width, height);
  if (!surface) {
    throw new Error('Could not prepare an export canvas.');
  }

  const canvas = surface.getCanvas();
  const background = Skia.Paint();
  background.setColor(Skia.Color('#000000'));
  canvas.drawRect(Skia.XYWHRect(0, 0, width, height), background);

  const fitted = fitContain(image.width(), image.height(), width, height);
  const paint = Skia.Paint();
  canvas.drawImageRectOptions(
    image,
    Skia.XYWHRect(0, 0, image.width(), image.height()),
    Skia.XYWHRect(fitted.x, fitted.y, fitted.width, fitted.height),
    FilterMode.Linear,
    MipmapMode.None,
    paint
  );

  const snapshot = surface.makeImageSnapshot();
  const pixels = snapshot.readPixels(0, 0, {
    width,
    height,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });

  if (!pixels || !(pixels instanceof Uint8Array)) {
    throw new Error('Could not read export frame pixels.');
  }

  return pixels;
}

export async function createTimelapseExport({
  frames,
  intervalMs,
  onProgress,
}: CreateTimelapseExportOptions): Promise<string> {
  if (frames.length === 0) {
    throw new Error('Add at least one photo before exporting a timelapse.');
  }

  try {
    await ensureExportDirectory();

    const firstBytes = await readFileBytes(frames[0].uri);
    const firstImage = loadSkiaImage(firstBytes);
    const { width, height } = getOutputSize(firstImage.width(), firstImage.height());
    const delay = delayCentiseconds(intervalMs);
    const gif = GIFEncoder();

    for (let index = 0; index < frames.length; index += 1) {
      onProgress?.({ current: index + 1, total: frames.length });

      const bytes =
        index === 0 ? firstBytes : await readFileBytes(frames[index].uri);
      const image = index === 0 ? firstImage : loadSkiaImage(bytes);
      const rgba = renderFramePixels(image, width, height);
      const palette = quantize(rgba, MAX_PALETTE_COLORS);
      const indexed = applyPalette(rgba, palette);

      gif.writeFrame(indexed, width, height, {
        palette,
        delay,
        ...(index === 0 ? { repeat: 0 } : {}),
      });

      await yieldToUi();
    }

    gif.finish();

    const output = new File(
      Paths.cache,
      PROGRESSION_ROOT_DIR,
      EXPORTS_DIR,
      `timelapse-${Date.now()}.gif`
    );
    if (output.exists) {
      output.delete();
    }
    output.create();
    output.write(gif.bytes());

    return output.uri;
  } catch (error) {
    throw new Error(
      getErrorMessage(error, 'Could not create the timelapse export.')
    );
  }
}
