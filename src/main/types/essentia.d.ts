/**
 * Type declarations for essentia.js package.
 * Declares algorithms used for key detection and section detection.
 */

declare module 'essentia.js' {
  /** Pre-resolved WASM backend module (not a factory) */
  export const EssentiaWASM: EssentiaWASMModule

  /** Core JS API class */
  export const Essentia: EssentiaConstructor

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface EssentiaWASMModule {}

  interface EssentiaConstructor {
    new (wasmModule: EssentiaWASMModule, isDebug?: boolean): EssentiaInstance
  }

  interface EssentiaInstance {
    version: string
    algorithmNames: string

    /** Convert a Float32Array to Essentia's VectorFloat type */
    arrayToVector(array: Float32Array): unknown

    /** Free a VectorFloat from WASM memory */
    vectorToArray(vector: unknown): Float32Array

    /**
     * Apply a windowing function to an audio frame.
     * @returns { frame: VectorFloat }
     */
    Windowing(
      frame: unknown,
      normalized?: boolean,
      size?: number,
      type?: string,
      zeroPadding?: number,
      zeroPhase?: boolean
    ): { frame: unknown }

    /**
     * Compute the magnitude spectrum of an audio frame.
     * @returns { spectrum: VectorFloat }
     */
    Spectrum(frame: unknown, size?: number): { spectrum: unknown }

    /**
     * Compute MFCC from a spectrum.
     * @returns { mfcc: VectorFloat, bands: VectorFloat }
     */
    MFCC(
      spectrum: unknown,
      dctType?: number,
      highFrequencyBound?: number,
      inputSize?: number,
      liftering?: number,
      logType?: string,
      lowFrequencyBound?: number,
      normalize?: string,
      numberBands?: number,
      numberCoefficients?: number,
      sampleRate?: number,
      type?: string,
      warpingFormula?: string,
      weighting?: string
    ): { mfcc: unknown; bands: unknown }

    /**
     * Extract musical key from audio signal.
     * @returns { key: string, scale: string, strength: number }
     */
    KeyExtractor(
      audio: unknown,
      averageDetuningCorrection?: boolean,
      frameSize?: number,
      hopSize?: number,
      hpcpSize?: number,
      maxFrequency?: number,
      maximumSpectralPeaks?: number,
      minFrequency?: number,
      pcpThreshold?: number,
      profileType?: string,
      sampleRate?: number,
      spectralPeaksThreshold?: number,
      tuningFrequency?: number,
      weightType?: string,
      windowType?: string
    ): {
      key: string
      scale: string
      strength: number
    }

    /** Shutdown the Essentia WASM instance */
    shutdown(): void

    /** Delete the Essentia instance */
    delete(): void
  }
}
