/**
 * @module tl/source/Raster
 */
import Disposable from '../Disposable';
import Event from '../events/Event';
import EventType from '../events/EventType';
import ImageCanvas from '../ImageCanvas';
import ImageLayer from '../layer/Image';
import ImageSource, {ImageSourceEvent, ImageSourceEventTypes} from './Image';
import Source from './Source';
import TileLayer from '../layer/Tile';
import TileQueue from '../TileQueue';
import TileSource from './Tile';
import {createCanvasContext2D} from '../dom';
import {create as createTransform} from '../transform';
import {equals, Extent, getCenter, getHeight, getWidth} from '../extent';
import {getUid} from '../util';
import {FrameState} from "../Map";
import Layer, {LayerState} from "../layer/Layer";
import BaseEvent from "../events/Event";
import {CombinedOnSignature, EventTypes, OnSignature} from "../Observable";
import {ObjectEventTypes} from "../ObjectEventType";
import {ObjectEvent} from "../Object";
import ImageBase from '../ImageBase';
import { ProjectionLike } from '../proj';
import {ViewState} from "../View";
import Projection from "../proj/Projection";

let hasImageData: boolean = true;
try {
  new ImageData(10, 10);
} catch (_) {
  hasImageData = false;
}

/** @type {CanvasRenderingContext2D} */
let context: CanvasRenderingContext2D;

/**
 * @param {Uint8ClampedArray} data Image data.
 * @param {number} width Number of columns.
 * @param {number} height Number of rows.
 * @return {ImageData} Image data.
 */
export function newImageData(data: Uint8ClampedArray, width: number, height: number): ImageData {
  if (hasImageData) {
    return new ImageData(data, width, height);
  }

  if (!context) {
    context = document.createElement('canvas').getContext('2d');
  }
  const imageData = context.createImageData(width, height);
  imageData.data.set(data);
  return imageData;
}

export interface MinionData {
  buffers: ArrayBuffer[];
  meta: {[key: string]: any};
  imageOps: boolean;
  width: number;
  height: number;
}

/* istanbul ignore next */
/**
 * Create a function for running operations.  This function is serialized for
 * use in a worker.
 * @param {function(Array, Object):*} operation The operation.
 * @return {function(MinionData):ArrayBuffer} A function that takes an object with
 * buffers, meta, imageOps, width, and height properties and returns an array
 * buffer.
 */
function createMinion(operation: (images: any[], meta: any) => any): (data: MinionData) => ArrayBuffer {
  let workerHasImageData = true;
  try {
    new ImageData(10, 10);
  } catch (_) {
    workerHasImageData = false;
  }

  function newWorkerImageData(data, width, height) {
    if (workerHasImageData) {
      return new ImageData(data, width, height);
    }
    return {data: data, width: width, height: height};
  }

  return function (data) {
    // bracket notation for minification support
    const buffers = data['buffers'];
    const meta = data['meta'];
    const imageOps = data['imageOps'];
    const width = data['width'];
    const height = data['height'];

    const numBuffers = buffers.length;
    const numBytes = buffers[0].byteLength;

    if (imageOps) {
      const images = new Array(numBuffers);
      for (let b = 0; b < numBuffers; ++b) {
        images[b] = newWorkerImageData(
            new Uint8ClampedArray(buffers[b]),
            width,
            height
        );
      }
      const output = operation(images, meta).data;
      return output.buffer;
    }

    const output = new Uint8ClampedArray(numBytes);
    const arrays = new Array(numBuffers);
    const pixels = new Array(numBuffers);
    for (let b = 0; b < numBuffers; ++b) {
      arrays[b] = new Uint8ClampedArray(buffers[b]);
      pixels[b] = [0, 0, 0, 0];
    }
    for (let i = 0; i < numBytes; i += 4) {
      for (let j = 0; j < numBuffers; ++j) {
        const array = arrays[j];
        pixels[j][0] = array[i];
        pixels[j][1] = array[i + 1];
        pixels[j][2] = array[i + 2];
        pixels[j][3] = array[i + 3];
      }
      const pixel = operation(pixels, meta);
      output[i] = pixel[0];
      output[i + 1] = pixel[1];
      output[i + 2] = pixel[2];
      output[i + 3] = pixel[3];
    }
    return output.buffer;
  };
}

/**
 * Create a worker for running operations.
 * @param {ProcessorOptions} config Processor options.
 * @param {function(MessageEvent): void} onMessage Called with a message event.
 * @return {Worker} The worker.
 */
function createWorker(config: ProcessorOptions, onMessage: (event: MessageEvent) => void): Worker {
  const lib = Object.keys(config.lib || {}).map(function (name) {
    return 'const ' + name + ' = ' + config.lib[name].toString() + ';';
  });

  const lines = lib.concat([
    'const __minion__ = (' + createMinion.toString() + ')(',
    config.operation.toString(),
    ');',
    'self.addEventListener("message", function(event) {',
    '  const buffer = __minion__(event.data);',
    '  self.postMessage({buffer: buffer, meta: event.data.meta}, [buffer]);',
    '});',
  ]);

  const worker = new Worker(
      typeof Blob === 'undefined'
          ? 'data:text/javascript;base64,' +
          Buffer.from(lines.join('\n'), 'binary').toString('base64')
          : URL.createObjectURL(new Blob(lines, {type: 'text/javascript'}))
  );
  worker.addEventListener('message', onMessage);
  return worker;
}

export interface FauxMessageEvent {
  data: {[key: string]: any};
}

/**
 * Create a faux worker for running operations.
 * @param {ProcessorOptions} config Configuration.
 * @param {function(FauxMessageEvent): void} onMessage Called with a message event.
 * @return {Object} The faux worker.
 */
function createFauxWorker(config: ProcessorOptions, onMessage: (event: FauxMessageEvent) => void): Worker {
  const minion = createMinion(config.operation);
  let terminated = false;
  return <Worker>{
    postMessage: function (data) {
      setTimeout(function () {
        if (terminated) {
          return;
        }
        onMessage({data: {buffer: minion(data), meta: data['meta']}});
      }, 0);
    },
    terminate: function () {
      terminated = true;
    },
  };
}

/**
 * @typedef {function(Error, ImageData, (Object|Array<Object>)): void} JobCallback
 */

export type JobCallback = (error: Error, imageData: ImageData, meta: {[key: string]: any} | Object[]) => void;

export interface Job {
  meta: {[key: string]: any};
  inputs: ImageData[];
  callback: JobCallback;
}

interface ProcessorOptions {
  threads: number;
  operation: Operation;
  lib?: { [key: string]: Function };
  queue: number;
  imageOps?: boolean;
}

/**
 * @classdesc
 * A processor runs pixel or image operations in workers.
 */
export class Processor extends Disposable {
  /**
   * @param {ProcessorOptions} config Configuration.
   */

  private _imageOps: boolean;
  private _workers: Worker[];
  private _queue: Job[];
  private _running: number;
  private _dataLookup: { [key: number]: any };
  private _job: Job;

  constructor(config: ProcessorOptions) {
    super();

    this._imageOps = !!config.imageOps;
    let threads: number;

    if (config.threads === 0) {
      threads = 0;
    } else if (this._imageOps) {
      threads = 1;
    } else {
      threads = config.threads || 1;
    }

    /**
     * @type {Array<Worker>}
     */
    const workers: Worker[] = new Array(threads);
    if (threads) {
      for (let i = 0; i < threads; ++i) {
        workers[i] = createWorker(config, this._onWorkerMessage.bind(this, i));
      }
    } else {
      workers[0] = createFauxWorker(
          config,
          this._onWorkerMessage.bind(this, 0)
      );
    }
    this._workers = workers;

    /**
     * @type {Array<Job>}
     * @private
     */
    this._queue = [];

    this._maxQueueLength = config.queue || Infinity;
    this._running = 0;

    /**
     * @type {Object<number, any>}
     * @private
     */
    this._dataLookup = {};

    /**
     * @type {Job}
     * @private
     */
    this._job = null;
  }

  private _maxQueueLength: number;


  /**
   * Run operation on input data.
   * @param {Array<ImageData>} inputs Array of image data.
   * @param {Object} meta A user data object.  This is passed to all operations
   *     and must be serializable.
   * @param {function(Error, ImageData, Object): void} callback Called when work
   *     completes.  The first argument is any error.  The second is the ImageData
   *     generated by operations.  The third is the user data object.
   */
  public process(inputs: ImageData[], meta: {[key: string]: any}, callback: JobCallback) {
    this._enqueue({
      inputs: inputs,
      meta: meta,
      callback: callback,
    });
    this._dispatch();
  }

  /**
   * Add a job to the queue.
   * @param {Job} job The job.
   */
  private _enqueue(job: Job): void {
    this._queue.push(job);
    while (this._queue.length > this._maxQueueLength) {
      this._queue.shift().callback(null, null, null);
    }
  }

  /**
   * Dispatch a job.
   */
  private _dispatch(): void {
    if (this._running || this._queue.length === 0) {
      return;
    }

    const job = this._queue.shift();
    this._job = job;
    const width = job.inputs[0].width;
    const height = job.inputs[0].height;
    const buffers = job.inputs.map(function (input) {
      return input.data.buffer;
    });
    const threads = this._workers.length;
    this._running = threads;
    if (threads === 1) {
      this._workers[0].postMessage(
          {
            buffers: buffers,
            meta: job.meta,
            imageOps: this._imageOps,
            width: width,
            height: height,
          },
          buffers
      );
      return;
    }

    const length = job.inputs[0].data.length;
    const segmentLength = 4 * Math.ceil(length / 4 / threads);
    for (let i = 0; i < threads; ++i) {
      const offset = i * segmentLength;
      const slices = [];
      for (let j = 0, jj = buffers.length; j < jj; ++j) {
        slices.push(buffers[j].slice(offset, offset + segmentLength));
      }
      this._workers[i].postMessage(
          {
            buffers: slices,
            meta: job.meta,
            imageOps: this._imageOps,
            width: width,
            height: height,
          },
          slices
      );
    }
  }

  /**
   * Handle messages from the worker.
   * @param {number} index The worker index.
   * @param {MessageEvent} event The message event.
   */
  private _onWorkerMessage(index: number, event: MessageEvent): void {
    if (this.disposed) {
      return;
    }
    this._dataLookup[index] = event.data;
    --this._running;
    if (this._running === 0) {
      this._resolveJob();
    }
  }

  /**
   * Resolve a job.  If there are no more worker threads, the processor callback
   * will be called.
   */
  private _resolveJob(): void {
    const job = this._job;
    const threads = this._workers.length;
    let data, meta;
    if (threads === 1) {
      data = new Uint8ClampedArray(this._dataLookup[0]['buffer']);
      meta = this._dataLookup[0]['meta'];
    } else {
      const length = job.inputs[0].data.length;
      data = new Uint8ClampedArray(length);
      meta = new Array(threads);
      const segmentLength = 4 * Math.ceil(length / 4 / threads);
      for (let i = 0; i < threads; ++i) {
        const buffer = this._dataLookup[i]['buffer'];
        const offset = i * segmentLength;
        data.set(new Uint8ClampedArray(buffer), offset);
        meta[i] = this._dataLookup[i]['meta'];
      }
    }
    this._job = null;
    this._dataLookup = {};
    job.callback(
        null,
        newImageData(data, job.inputs[0].width, job.inputs[0].height),
        meta
    );
    this._dispatch();
  }

  /**
   * Terminate all workers associated with the processor.
   */
  protected disposeInternal(): void {
    for (let i = 0; i < this._workers.length; ++i) {
      this._workers[i].terminate();
    }
    this._workers.length = 0;
  }
}

/**
 * A function that takes an array of input data, performs some operation, and
 * returns an array of output data.
 * For `pixel` type operations, the function will be called with an array of
 * pixels, where each pixel is an array of four numbers (`[r, g, b, a]`) in the
 * range of 0 - 255. It should return a single pixel array.
 * For `'image'` type operations, functions will be called with an array of
 * [ImageData](https://developer.mozilla.org/en-US/docs/Web/API/ImageData)
 * and should return a single
 * [ImageData](https://developer.mozilla.org/en-US/docs/Web/API/ImageData).
 * The operations
 * are called with a second "data" argument, which can be used for storage.  The
 * data object is accessible from raster events, where it can be initialized in
 * "beforeoperations" and accessed again in "afteroperations".
 *
 * @typedef {function((Array<Array<number>>|Array<ImageData>), Object):
 *     (Array<number>|ImageData)} Operation
 */

export type Operation = (pixels: number[][] | ImageData[], data: {[key: string]: any}) => number[] | ImageData;

/**
 * @enum {string}
 */
export enum RasterEventType {
  /**
   * Triggered before operations are run.  Listeners will receive an event object with
   * a `data` property that can be used to make data available to operations.
   * @event module:tl/source/Raster.RasterSourceEvent#beforeoperations
   * @api
   */
  BEFOREOPERATIONS = 'beforeoperations',

  /**
   * Triggered after operations are run.  Listeners will receive an event object with
   * a `data` property.  If more than one thread is used, `data` will be an array of
   * objects.  If a single thread is used, `data` will be a single object.
   * @event module:tl/source/Raster.RasterSourceEvent#afteroperations
   * @api
   */
  AFTEROPERATIONS = 'afteroperations',
}

export type RasterOperationType = 'pixel' | 'image';

export type RasterSourceEventTypes = ImageSourceEventTypes | 'beforeoperations' | 'afteroperations';

/**
 * @classdesc
 * Events emitted by {@link module:tl/source/Raster~RasterSource} instances are instances of this
 * type.
 */
export class RasterSourceEvent extends Event {
  /**
   * @param {string} type Type.
   * @param {import("../Map").FrameState} frameState The frame state.
   * @param {Object|Array<Object>} data An object made available to operations.  For "afteroperations" evenets
   * this will be an array of objects if more than one thread is used.
   */

  public extent: Extent;
  public resolution: number;
  public data: {[key: string]: any};

  constructor(type: string, frameState: FrameState, data: {[key: string]: any} | Object[]) {
    super(type);

    /**
     * The raster extent.
     * @type {import("../extent").Extent}
     * @api
     */
    this.extent = frameState.extent;

    /**
     * The pixel resolution (map units per pixel).
     * @type {number}
     * @api
     */
    this.resolution = frameState.viewState.resolution / frameState.pixelRatio;

    /**
     * An object made available to all operations.  This can be used by operations
     * as a storage object (e.g. for calculating statistics).
     * @type {Object}
     * @api
     */
    this.data = data;
  }
}

export interface RasterSourceOptions {
  sources: Source[] | Layer<any, any>[];
  operation?: Operation;
  lib?: {[key: string]: any};
  threads?: number;
  operationType?: RasterOperationType;
  resolutions?: Array<number> | null;
}

export type RasterSourceOnSignature<Return> =
    OnSignature<EventTypes, BaseEvent, Return> &
    OnSignature<ObjectEventTypes, ObjectEvent, Return> &
    OnSignature<ImageSourceEventTypes, ImageSourceEvent, Return> &
    OnSignature<RasterSourceEventTypes, RasterSourceEvent, Return> &
    CombinedOnSignature<EventTypes | ObjectEventTypes | RasterSourceEventTypes, Return>;

/**
 * @classdesc
 * A source that transforms data from any number of input sources using an
 * {@link module:tl/source/Raster~Operation} function to transform input pixel values into
 * output pixel values.
 *
 * @fires module:tl/source/Raster.RasterSourceEvent
 * @api
 */
class RasterSource extends ImageSource {

  /**
   * @param {Options} options Options.
   */

  private processor_: Processor;
  private operationType_: RasterOperationType;
  private threads_: number;
  private layers_: Layer<any, any>[];
  private useResolutions_: boolean;
  private tileQueue_: TileQueue;
  private requestedFrameState_: FrameState;
  private renderedImageCanvas_: ImageCanvas;
  private renderedRevision_: number;
  private frameState_: FrameState;

  constructor(options: RasterSourceOptions) {
    super({
      projection: null,
    });

    /***
     * @type {RasterSourceOnSignature<import("../events").EventsKey>}
     */
    this.on;

    /***
     * @type {RasterSourceOnSignature<import("../events").EventsKey>}
     */
    this.once;

    /***
     * @type {RasterSourceOnSignature<void>}
     */
    this.un;

    /**
     * @private
     * @type {Processor}
     */
    this.processor_ = null;

    /**
     * @private
     * @type {RasterOperationType}
     */
    this.operationType_ =
      options.operationType !== undefined ? options.operationType : 'pixel';

    /**
     * @private
     * @type {number}
     */
    this.threads_ = options.threads !== undefined ? options.threads : 1;

    /**
     * @private
     * @type {Array<import("../layer/Layer").default>}
     */
    this.layers_ = createLayers(options.sources);

    const changed = this.changed.bind(this);
    for (let i = 0, ii = this.layers_.length; i < ii; ++i) {
      this.layers_[i].addEventListener(EventType.CHANGE, changed);
    }
    
    /** @type {boolean} */
    this.useResolutions_ = options.resolutions !== null;

    /**
     * @private
     * @type {import("../TileQueue").default}
     */
    this.tileQueue_ = new TileQueue(function () {
      return 1;
    }, this.processSources_.bind(this));

    /**
     * The most recently requested frame state.
     * @type {import("../Map").FrameState}
     * @private
     */
    this.requestedFrameState_;

    /**
     * The most recently rendered image canvas.
     * @type {import("../ImageCanvas").default}
     * @private
     */
    this.renderedImageCanvas_ = null;

    /**
     * The most recently rendered revision.
     * @type {number}
     */
    this.renderedRevision_;

    /**
     * @private
     * @type {import("../Map").FrameState}
     */
    this.frameState_ = {
      animate: false,
      coordinateToPixelTransform: createTransform(),
      declutterTree: null,
      extent: null,
      index: 0,
      layerIndex: 0,
      layerStatesArray: getLayerStatesArray(this.layers_),
      pixelRatio: 1,
      pixelToCoordinateTransform: createTransform(),
      postRenderFunctions: [],
      size: [0, 0],
      tileQueue: this.tileQueue_,
      time: Date.now(),
      usedTiles: {},
      viewState: (<ViewState>{
        rotation: 0,
      }),
      viewHints: [],
      wantedTiles: {},
      mapId: getUid(this),
      renderTargets: {},
    };

    this.setAttributions(function (frameState) {
      const attributions = [];
      for (
        let index = 0, iMax = options.sources.length;
        index < iMax;
        ++index
      ) {
        const sourceOrLayer = options.sources[index];
        const source =
          sourceOrLayer instanceof Source
            ? sourceOrLayer
            : sourceOrLayer.getSource();
        if (!source) {
          continue;
        }
        const attributionGetter = source.getAttributions();
        if (typeof attributionGetter === 'function') {
          const sourceAttribution = attributionGetter(frameState);
          attributions.push.apply(attributions, sourceAttribution);
        }
      }
      return attributions.length !== 0 ? attributions : null;
    });

    if (options.operation !== undefined) {
      this.setOperation(options.operation, options.lib);
    }
  }

  protected getImageInternal(extent: Extent, resolution: number, pixelRatio: number, projection: ProjectionLike): ImageBase {
    throw new Error('Method not implemented.');
  }

  /**
   * Set the operation.
   * @param {Operation} operation New operation.
   * @param {Object} [lib] Functions that will be available to operations run
   *     in a worker.
   * @api
   */
  public setOperation(operation: Operation, lib: {[key: string]: any}): void {
    if (this.processor_) {
      this.processor_.dispose();
    }

    this.processor_ = new Processor({
      operation: operation,
      imageOps: this.operationType_ === 'image',
      queue: 1,
      lib: lib,
      threads: this.threads_,
    });
    this.changed();
  }

  /**
   * Update the stored frame state.
   * @param {import("../extent").Extent} extent The view extent (in map units).
   * @param {number} resolution The view resolution.
   * @param {import("../proj/Projection").default} projection The view projection.
   * @return {import("../Map").FrameState} The updated frame state.
   * @private
   */
  private updateFrameState_(extent: Extent, resolution: number, projection: Projection): FrameState {
    const frameState = /** @type {import("../Map").FrameState} */ (
      Object.assign({}, this.frameState_)
    );

    frameState.viewState = /** @type {import("../View").State} */ (
      Object.assign({}, frameState.viewState)
    );

    const center = getCenter(extent);

    frameState.size[0] = Math.ceil(getWidth(extent) / resolution);
    frameState.size[1] = Math.ceil(getHeight(extent) / resolution);
    frameState.extent = [
      center[0] - (frameState.size[0] * resolution) / 2,
      center[1] - (frameState.size[1] * resolution) / 2,
      center[0] + (frameState.size[0] * resolution) / 2,
      center[1] + (frameState.size[1] * resolution) / 2,
    ];
    frameState.time = Date.now();

    const viewState = frameState.viewState;
    viewState.center = center;
    viewState.projection = projection;
    viewState.resolution = resolution;
    return frameState;
  }

  /**
   * Determine if all sources are ready.
   * @return {boolean} All sources are ready.
   * @private
   */
  private allSourcesReady_(): boolean {
    let ready = true;
    let source;
    for (let i = 0, ii = this.layers_.length; i < ii; ++i) {
      source = this.layers_[i].getSource();
      if (!source || source.getState() !== 'ready') {
        ready = false;
        break;
      }
    }
    return ready;
  }

  /**
   * @param {import("../extent").Extent} extent Extent.
   * @param {number} resolution Resolution.
   * @param {number} pixelRatio Pixel ratio.
   * @param {import("../proj/Projection").default} projection Projection.
   * @return {import("../ImageCanvas").default} Single image.
   */
  public getImage(extent: Extent, resolution: number, pixelRatio: number, projection: Projection): ImageCanvas {
    if (!this.allSourcesReady_()) {
      return null;
    }

    this.tileQueue_.loadMoreTiles(16, 16);

    resolution = this.findNearestResolution(resolution);
    const frameState = this.updateFrameState_(extent, resolution, projection);
    this.requestedFrameState_ = frameState;

    // check if we can't reuse the existing tl/ImageCanvas
    if (this.renderedImageCanvas_) {
      const renderedResolution = this.renderedImageCanvas_.getResolution();
      const renderedExtent = this.renderedImageCanvas_.getExtent();
      if (
        resolution !== renderedResolution ||
        !equals(frameState.extent, renderedExtent)
      ) {
        this.renderedImageCanvas_ = null;
      }
    }

    if (
      !this.renderedImageCanvas_ ||
      this.getRevision() !== this.renderedRevision_
    ) {
      this.processSources_();
    }

    if (frameState.animate) {
      requestAnimationFrame(this.changed.bind(this));
    }

    return this.renderedImageCanvas_;
  }

  /**
   * Start processing source data.
   * @private
   */
  private processSources_(): void {
    const frameState = this.requestedFrameState_;
    const len = this.layers_.length;
    const imageDatas = new Array(len);
    for (let i = 0; i < len; ++i) {
      frameState.layerIndex = i;
      frameState.renderTargets = {};
      const imageData = getImageData(this.layers_[i], frameState);
      if (imageData) {
        imageDatas[i] = imageData;
      } else {
        return;
      }
    }

    const data = {};
    this.dispatchEvent(
      new RasterSourceEvent(RasterEventType.BEFOREOPERATIONS, frameState, data)
    );
    this.processor_.process(
      imageDatas,
      data,
      this.onWorkerComplete_.bind(this, frameState)
    );
  }

  /**
   * Called when pixel processing is complete.
   * @param {import("../Map").FrameState} frameState The frame state.
   * @param {Error} err Any error during processing.
   * @param {ImageData} output The output image data.
   * @param {Object|Array<Object>} data The user data (or an array if more than one thread).
   * @private
   */
  private onWorkerComplete_(frameState: FrameState, err: Error, output: ImageData, data: {[key: string]: any} | Object[]): void {
    if (err || !output) {
      return;
    }

    // do nothing if extent or resolution changed
    const extent = frameState.extent;
    const resolution = frameState.viewState.resolution;
    if (
      resolution !== this.requestedFrameState_.viewState.resolution ||
      !equals(extent, this.requestedFrameState_.extent)
    ) {
      return;
    }

    let context;
    if (this.renderedImageCanvas_) {
      context = this.renderedImageCanvas_.getImage().getContext('2d');
    } else {
      const width = Math.round(getWidth(extent) / resolution);
      const height = Math.round(getHeight(extent) / resolution);
      context = createCanvasContext2D(width, height);
      this.renderedImageCanvas_ = new ImageCanvas(
        extent,
        resolution,
        1,
        context.canvas
      );
    }
    context.putImageData(output, 0, 0);

    if (frameState.animate) {
      requestAnimationFrame(this.changed.bind(this));
    } else {
      this.changed();
    }
    this.renderedRevision_ = this.getRevision();

    this.dispatchEvent(
      new RasterSourceEvent(RasterEventType.AFTEROPERATIONS, frameState, data)
    );
  }

  /**
   * @param {import("../proj/Projection").default} [projection] Projection.
   * @return {Array<number>|null} Resolutions.
   */
  public getResolutions(projection: Projection): number[] | null {
    if (!this.useResolutions_) {
      return null;
    }
    let resolutions = super.getResolutions();
    if (!resolutions) {
      for (let i = 0, ii = this.layers_.length; i < ii; ++i) {
        const source = this.layers_[i].getSource();
        resolutions = source.getResolutions(projection);
        if (resolutions) {
          break;
        }
      }
    }
    return resolutions;
  }

  protected disposeInternal(): void {
    if (this.processor_) {
      this.processor_.dispose();
    }
    super.disposeInternal();
  }
}

/**
 * Clean up and unregister the worker.
 * @function
 * @api
 */
// RasterSource.prototype.dispose;

/**
 * A reusable canvas context.
 * @type {CanvasRenderingContext2D}
 * @private
 */
let sharedContext: CanvasRenderingContext2D = null;

/**
 * Get image data from a layer.
 * @param {import("../layer/Layer").default} layer Layer to render.
 * @param {import("../Map").FrameState} frameState The frame state.
 * @return {ImageData} The image data.
 */
function getImageData(layer: Layer<any, any>, frameState: FrameState): ImageData {
  const renderer = layer.getRenderer();
  if (!renderer) {
    throw new Error('Unsupported layer type: ' + layer);
  }

  if (!renderer.prepareFrame(frameState)) {
    return null;
  }
  const width = frameState.size[0];
  const height = frameState.size[1];
  if (width === 0 || height === 0) {
    return null;
  }
  const container = renderer.renderFrame(frameState, null);
  let element;
  if (container instanceof HTMLCanvasElement) {
    element = container;
  } else {
    if (container) {
      element = container.firstElementChild;
    }
    if (!(element instanceof HTMLCanvasElement)) {
      throw new Error('Unsupported rendered element: ' + element);
    }
    if (element.width === width && element.height === height) {
      const context = element.getContext('2d');
      return context.getImageData(0, 0, width, height);
    }
  }

  if (!sharedContext) {
    sharedContext = <CanvasRenderingContext2D>createCanvasContext2D(width, height, undefined, {
      willReadFrequently: true,
    });
  } else {
    const canvas = sharedContext.canvas;
    if (canvas.width !== width || canvas.height !== height) {
      sharedContext = <CanvasRenderingContext2D>createCanvasContext2D(width, height, undefined, {
        willReadFrequently: true,
      });
    } else {
      sharedContext.clearRect(0, 0, width, height);
    }
  }
  sharedContext.drawImage(element, 0, 0, width, height);
  return sharedContext.getImageData(0, 0, width, height);
}

/**
 * Get a list of layer states from a list of layers.
 * @param {Array<import("../layer/Layer").default>} layers Layers.
 * @return {Array<import("../layer/Layer").State>} The layer states.
 */
function getLayerStatesArray(layers: Layer<any, any>[]): LayerState[] {
  return layers.map(function (layer) {
    return layer.getLayerState();
  });
}

/**
 * Create layers for all sources.
 * @param {Array<import("./Source").default|import("../layer/Layer").default>} sources The sources.
 * @return {Array<import("../layer/Layer").default>} Array of layers.
 */
function createLayers(sources: Source[] | Layer<any, any>[]): Layer<any, any>[] {
  const len = sources.length;
  const layers = new Array(len);
  for (let i = 0; i < len; ++i) {
    layers[i] = createLayer(sources[i]);
  }
  return layers;
}

/**
 * Create a layer for the provided source.
 * @param {import("./Source").default|import("../layer/Layer").default} layerOrSource The layer or source.
 * @return {import("../layer/Layer").default} The layer.
 */
function createLayer(layerOrSource: Source | Layer<any, any>): Layer<any, any> {
  // @type {import("../layer/Layer").default}
  let layer: Layer<any,any>;
  if (layerOrSource instanceof Source) {
    if (layerOrSource instanceof TileSource) {
      layer = new TileLayer({source: layerOrSource});
    } else if (layerOrSource instanceof ImageSource) {
      layer = new ImageLayer({source: layerOrSource});
    }
  } else {
    layer = layerOrSource;
  }
  return layer;
}

export default RasterSource;
