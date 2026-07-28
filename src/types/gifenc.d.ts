declare module 'gifenc' {
  export type RGBPalette = number[][];

  export type QuantizeOptions = {
    format?: 'rgb565' | 'rgb444' | 'rgba4444';
    oneBitAlpha?: boolean | number;
    clearAlpha?: boolean;
    clearAlphaThreshold?: number;
    clearAlphaColor?: number;
  };

  export type WriteFrameOptions = {
    palette?: RGBPalette;
    delay?: number;
    repeat?: number;
    transparent?: number;
    dispose?: number;
  };

  export type GIFEncoderInstance = {
    writeFrame: (
      index: Uint8Array,
      width: number,
      height: number,
      options?: WriteFrameOptions
    ) => void;
    finish: () => void;
    bytes: () => Uint8Array;
  };

  export function GIFEncoder(): GIFEncoderInstance;
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: QuantizeOptions
  ): RGBPalette;
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: RGBPalette,
    format?: 'rgb565' | 'rgb444' | 'rgba4444'
  ): Uint8Array;
}
