/**
 * @module tl/renderer/canvas/ImageLayer
 */
import CanvasLayerRenderer from './Layer';
import ImageState from '../../ImageState';
import ViewHint from '../../ViewHint';
import {
  apply as applyTransform,
  compose as composeTransform,
  makeInverse,
  toString as toTransformString,
} from '../../transform';
import {
  containsCoordinate,
  containsExtent,
  getHeight,
  getIntersection,
  getWidth,
  intersects as intersectsExtent,
  isEmpty,
} from '../../extent';
import {fromUserExtent} from '../../proj';
import ImageBase from "../../ImageBase";
import ImageLayer from "../../layer/Image";
import {FrameState} from "../../Map";
import {Pixel} from "../../pixel";
import { FeatureLike } from '../../Feature';
import {Coordinate} from '../../coordinate';

/**
 * @classdesc
 * Canvas renderer for image layers.
 * @api
 */
class CanvasImageLayerRenderer extends CanvasLayerRenderer<ImageLayer> {

  /**
   * @param {import("../../layer/Image").default} imageLayer Image layer.
   */

  protected image_: ImageBase;

  constructor(imageLayer: ImageLayer) {
    super(imageLayer);

    /**
     * @protected
     * @type {?import("../../ImageBase").default}
     */
    this.image_ = null;
  }

  /**
   * @return {HTMLCanvasElement|HTMLImageElement|HTMLVideoElement} Image.
   */
  public getImage(): HTMLCanvasElement|HTMLImageElement|HTMLVideoElement {
    return this.image_ ? this.image_.getImage() : null;
  }

  /**
   * Determine whether render should be called.
   * @param {import("../../Map").FrameState} frameState Frame state.
   * @return {boolean} Layer is ready to be rendered.
   */
  public prepareFrame(frameState: FrameState): boolean {
    const layerState = frameState.layerStatesArray[frameState.layerIndex];
    const pixelRatio = frameState.pixelRatio;
    const viewState = frameState.viewState;
    const viewResolution = viewState.resolution;

    const imageSource = this.getLayer().getSource();

    const hints = frameState.viewHints;

    let renderedExtent = frameState.extent;
    if (layerState.extent !== undefined) {
      renderedExtent = getIntersection(
        renderedExtent,
        fromUserExtent(layerState.extent, viewState.projection)
      );
    }

    if (
      !hints[ViewHint.ANIMATING] &&
      !hints[ViewHint.INTERACTING] &&
      !isEmpty(renderedExtent)
    ) {
      if (imageSource) {
        const projection = viewState.projection;
        const image = imageSource.getImage(
          renderedExtent,
          viewResolution,
          pixelRatio,
          projection
        );
        if (image) {
          if (this.loadImage(image)) {
            this.image_ = image;
          } else if (image.getState() === ImageState.EMPTY) {
            this.image_ = null;
          }
        }
      } else {
        this.image_ = null;
      }
    }

    return !!this.image_;
  }

  /**
   * @param {import("../../pixel").Pixel} pixel Pixel.
   * @return {Uint8ClampedArray} Data at the pixel location.
   */
  public getData(pixel: Pixel): Uint8ClampedArray {
    const frameState = this.frameState;
    if (!frameState) {
      return null;
    }

    const layer = this.getLayer();
    const coordinate = <Coordinate>applyTransform(
      frameState.pixelToCoordinateTransform,
      <Pixel>pixel.slice()
    );

    const layerExtent = layer.getExtent();
    if (layerExtent) {
      if (!containsCoordinate(layerExtent, coordinate)) {
        return null;
      }
    }

    const imageExtent = this.image_.getExtent();
    const img = this.getImage();

    const imageMapWidth = getWidth(imageExtent);
    const col = Math.floor(
      img.width * ((coordinate[0] - imageExtent[0]) / imageMapWidth)
    );
    if (col < 0 || col >= img.width) {
      return null;
    }

    const imageMapHeight = getHeight(imageExtent);
    const row = Math.floor(
      img.height * ((imageExtent[3] - coordinate[1]) / imageMapHeight)
    );
    if (row < 0 || row >= img.height) {
      return null;
    }

    return this.getImageData(img, col, row);
  }

  /**
   * Render the layer.
   * @param {import("../../Map").FrameState} frameState Frame state.
   * @param {HTMLElement} target Target that may be used to render content to.
   * @return {HTMLElement} The rendered element.
   */
  public renderFrame(frameState: FrameState, target: HTMLElement): HTMLElement {
    const image = this.image_;
    const imageExtent = image.getExtent();
    const imageResolution = image.getResolution();
    const imagePixelRatio = image.getPixelRatio();
    const layerState = frameState.layerStatesArray[frameState.layerIndex];
    const pixelRatio = frameState.pixelRatio;
    const viewState = frameState.viewState;
    const viewCenter = viewState.center;
    const viewResolution = viewState.resolution;
    const scale =
      (pixelRatio * imageResolution) / (viewResolution * imagePixelRatio);

    const extent = frameState.extent;
    const resolution = viewState.resolution;
    const rotation = viewState.rotation;
    // desired dimensions of the canvas in pixels
    const width = Math.round((getWidth(extent) / resolution) * pixelRatio);
    const height = Math.round((getHeight(extent) / resolution) * pixelRatio);

    // set forward and inverse pixel transforms
    composeTransform(
      this.pixelTransform,
      frameState.size[0] / 2,
      frameState.size[1] / 2,
      1 / pixelRatio,
      1 / pixelRatio,
      rotation,
      -width / 2,
      -height / 2
    );
    makeInverse(this.inversePixelTransform, this.pixelTransform);

    const canvasTransform = toTransformString(this.pixelTransform);

    this.useContainer(target, canvasTransform, this.getBackground(frameState));

    const context = this.context;
    const canvas = context.canvas;

    if (canvas.width != width || canvas.height != height) {
      canvas.width = width;
      canvas.height = height;
    } else if (!this.containerReused) {
      context.clearRect(0, 0, width, height);
    }

    // clipped rendering if layer extent is set
    let clipped = false;
    let render = true;
    if (layerState.extent) {
      const layerExtent = fromUserExtent(
        layerState.extent,
        viewState.projection
      );
      render = intersectsExtent(layerExtent, frameState.extent);
      clipped = render && !containsExtent(layerExtent, frameState.extent);
      if (clipped) {
        this.clipUnrotated(context, frameState, layerExtent);
      }
    }

    const img = this.getImage();

    const transform = composeTransform(
      this.tempTransform,
      width / 2,
      height / 2,
      scale,
      scale,
      0,
      (imagePixelRatio * (imageExtent[0] - viewCenter[0])) / imageResolution,
      (imagePixelRatio * (viewCenter[1] - imageExtent[3])) / imageResolution
    );

    this.renderedResolution = (imageResolution * pixelRatio) / imagePixelRatio;

    const dw = img.width * transform[0];
    const dh = img.height * transform[3];

    if (!this.getLayer().getSource().getInterpolate()) {
      context.imageSmoothingEnabled = false;
    }

    this.preRender(context, frameState);
    if (render && dw >= 0.5 && dh >= 0.5) {
      const dx = transform[4];
      const dy = transform[5];
      const opacity = layerState.opacity;
      let previousAlpha: number;
      if (opacity !== 1) {
        previousAlpha = context.globalAlpha;
        context.globalAlpha = opacity;
      }
      context.drawImage(img, 0, 0, +img.width, +img.height, dx, dy, dw, dh);
      if (opacity !== 1) {
        context.globalAlpha = previousAlpha;
      }
    }
    this.postRender(context, frameState);

    if (clipped) {
      context.restore();
    }
    context.imageSmoothingEnabled = true;

    if (canvasTransform !== canvas.style.transform) {
      canvas.style.transform = canvasTransform;
    }

    return this.container;
  }

  public getFeatures(pixel: Pixel): Promise<FeatureLike[]> {
    throw new Error('Method not implemented.');
  }
  public forEachFeatureAtCoordinate(coordinate: Coordinate, frameState: FrameState, hitTolerance: number, callback: any, matches: any[]) {
    throw new Error('Method not implemented.');
  }
  public handleFontsChanged(): void {
    throw new Error('Method not implemented.');
  }
}

export default CanvasImageLayerRenderer;
