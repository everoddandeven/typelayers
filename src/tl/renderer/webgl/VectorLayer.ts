/**
 * @module tl/renderer/webgl/VectorLayer
 */
import BaseVector from '../../layer/BaseVector';
import MixedGeometryBatch from '../../render/webgl/MixedGeometryBatch';
import VectorEventType from '../../source/VectorEventType';
import VectorStyleRenderer from '../../render/webgl/VectorStyleRenderer';
import ViewHint from '../../ViewHint';
import WebGLLayerRenderer from './Layer';
import {DefaultUniform} from '../../webgl/Helper';
import {buffer, createEmpty, equals, getWidth} from '../../extent';
import {
  create as createMat4,
  fromTransform as mat4FromTransform,
} from '../../vec/mat4';
import {
  create as createTransform,
  multiply as multiplyTransform,
  setFromArray as setFromTransform,
  translate as translateTransform,
} from '../../transform';
import {listen, unlistenByKey} from '../../events';

export const Uniforms = {
  ...DefaultUniform,
  RENDER_EXTENT: 'u_renderExtent', // intersection of layer, source, and view extent
  GLOBAL_ALPHA: 'u_globalAlpha',
};

/**
 * @typedef {import('../../render/webgl/VectorStyleRenderer').VectorStyle} VectorStyle
 */

export type VectorStyle = VectorStyleRenderer;

interface WebGLVectorLayerRendererOptions {
  className?: string;
  style: VectorStyle | Array<VectorStyle>;
  postProcesses?: Array<import("./Layer").PostProcessesOptions>;
}

/**
 * @classdesc
 * Experimental WebGL vector renderer. Supports polygons, lines and points:
 *  * Polygons are broken down into triangles
 *  * Lines are rendered as strips of quads
 *  * Points are rendered as quads
 *
 * You need to provide vertex and fragment shaders as well as custom attributes for each type of geometry. All shaders
 * can access the uniforms in the {@link module:tl/webgl/Helper~DefaultUniform} enum.
 * The vertex shaders can access the following attributes depending on the geometry type:
 *  * For polygons: {@link module:tl/render/webgl/PolygonBatchRenderer~Attributes}
 *  * For line strings: {@link module:tl/render/webgl/LineStringBatchRenderer~Attributes}
 *  * For points: {@link module:tl/render/webgl/PointBatchRenderer~Attributes}
 *
 * Please note that the fragment shaders output should have premultiplied alpha, otherwise visual anomalies may occur.
 *
 * Note: this uses {@link module:tl/webgl/Helper~WebGLHelper} internally.
 */
class WebGLVectorLayerRenderer extends WebGLLayerRenderer {
  /**
   * @param {import("../../layer/Layer").default} layer Layer.
   * @param {Options} options Options.
   */
  constructor(layer, options) {
    const uniforms = {
      [Uniforms.RENDER_EXTENT]: [0, 0, 0, 0],
      [Uniforms.GLOBAL_ALPHA]: 1,
    };

    super(layer, {
      uniforms: uniforms,
      postProcesses: options.postProcesses,
    });

    this.sourceRevision_ = -1;

    this.previousExtent_ = createEmpty();

    /**
     * This transform is updated on every frame and is the composition of:
     * - invert of the world->screen transform that was used when rebuilding buffers (see `this.renderTransform_`)
     * - current world->screen transform
     * @type {import("../../transform").Transform}
     * @private
     */
    this.currentTransform_ = createTransform();

    this.tmpTransform_ = createTransform();
    this.tmpMat4_ = createMat4();

    /**
     * @type {import("../../transform").Transform}
     * @private
     */
    this.currentFrameStateTransform_ = createTransform();

    /**
     * @type {Array<VectorStyle>}
     * @private
     */
    this.styles_ = [];

    /**
     * @type {Array<VectorStyleRenderer>}
     * @private
     */
    this.styleRenderers_ = [];

    /**
     * @type {Array<import('../../render/webgl/VectorStyleRenderer').WebGLBuffers>}
     * @private
     */
    this.buffers_ = [];

    this.applyOptions_(options);

    /**
     * @private
     */
    this.batch_ = new MixedGeometryBatch();

    const source = this.getLayer().getSource();
    this.batch_.addFeatures(source.getFeatures());
    this.sourceListenKeys_ = [
      listen(
        source,
        VectorEventType.ADDFEATURE,
        this.handleSourceFeatureAdded_,
        this
      ),
      listen(
        source,
        VectorEventType.CHANGEFEATURE,
        this.handleSourceFeatureChanged_,
        this
      ),
      listen(
        source,
        VectorEventType.REMOVEFEATURE,
        this.handleSourceFeatureDelete_,
        this
      ),
      listen(
        source,
        VectorEventType.CLEAR,
        this.handleSourceFeatureClear_,
        this
      ),
    ];
  }

  /**
   * @param {Options} options Options.
   * @private
   */
  applyOptions_(options) {
    this.styles_ = Array.isArray(options.style)
      ? options.style
      : [options.style];
  }

  /**
   * @private
   */
  createRenderers_() {
    this.buffers_ = [];
    this.styleRenderers_ = this.styles_.map(
      (style) => new VectorStyleRenderer(style, this.helper)
    );
  }

  reset(options) {
    this.applyOptions_(options);
    if (this.helper) {
      this.createRenderers_();
    }
    super.reset(options);
  }

  afterHelperCreated() {
    this.createRenderers_();
  }

  /**
   * @param {import("../../source/Vector").VectorSourceEvent} event Event.
   * @private
   */
  handleSourceFeatureAdded_(event) {
    const feature = event.feature;
    this.batch_.addFeature(feature);
  }

  /**
   * @param {import("../../source/Vector").VectorSourceEvent} event Event.
   * @private
   */
  handleSourceFeatureChanged_(event) {
    const feature = event.feature;
    this.batch_.changeFeature(feature);
  }

  /**
   * @param {import("../../source/Vector").VectorSourceEvent} event Event.
   * @private
   */
  handleSourceFeatureDelete_(event) {
    const feature = event.feature;
    this.batch_.removeFeature(feature);
  }

  /**
   * @private
   */
  handleSourceFeatureClear_() {
    this.batch_.clear();
  }

  /**
   * @param {import("../../transform").Transform} batchInvertTransform Inverse of the transformation in which geometries are expressed
   * @private
   */
  applyUniforms_(batchInvertTransform) {
    // world to screen matrix
    setFromTransform(this.tmpTransform_, this.currentFrameStateTransform_);
    multiplyTransform(this.tmpTransform_, batchInvertTransform);
    this.helper.setUniformMatrixValue(
      Uniforms.PROJECTION_MATRIX,
      mat4FromTransform(this.tmpMat4_, this.tmpTransform_)
    );
  }

  /**
   * Render the layer.
   * @param {import("../../Map").FrameState} frameState Frame state.
   * @return {HTMLElement} The rendered element.
   */
  renderFrame(frameState) {
    const gl = this.helper.getGL();
    this.preRender(gl, frameState);

    this.helper.prepareDraw(frameState);
    this.currentFrameStateTransform_ = this.helper.makeProjectionTransform(
      frameState,
      this.currentFrameStateTransform_
    );

    const layer = this.getLayer();
    const vectorSource = layer.getSource();
    const projection = frameState.viewState.projection;
    const multiWorld = vectorSource.getWrapX() && projection.canWrapX();
    const projectionExtent = projection.getExtent();
    const extent = frameState.extent;
    const worldWidth = multiWorld ? getWidth(projectionExtent) : null;
    const endWorld = multiWorld
      ? Math.ceil((extent[2] - projectionExtent[2]) / worldWidth) + 1
      : 1;
    let world = multiWorld
      ? Math.floor((extent[0] - projectionExtent[0]) / worldWidth)
      : 0;

    translateTransform(this.currentFrameStateTransform_, world * worldWidth, 0);
    do {
      for (let i = 0, ii = this.styleRenderers_.length; i < ii; i++) {
        const renderer = this.styleRenderers_[i];
        const buffers = this.buffers_[i];
        if (!buffers) {
          continue;
        }
        renderer.render(buffers, frameState, () => {
          this.applyUniforms_(buffers.invertVerticesTransform);
        });
      }
      translateTransform(this.currentFrameStateTransform_, worldWidth, 0);
    } while (++world < endWorld);

    this.helper.finalizeDraw(frameState);

    const canvas = this.helper.getCanvas();
    const layerState = frameState.layerStatesArray[frameState.layerIndex];
    const opacity = layerState.opacity;
    if (opacity !== parseFloat(canvas.style.opacity)) {
      canvas.style.opacity = String(opacity);
    }

    this.postRender(gl, frameState);
    return canvas;
  }

  /**
   * Determine whether renderFrame should be called.
   * @param {import("../../Map").FrameState} frameState Frame state.
   * @return {boolean} Layer is ready to be rendered.
   */
  prepareFrameInternal(frameState) {
    const layer = this.getLayer();
    const vectorSource = layer.getSource();
    const viewState = frameState.viewState;
    const viewNotMoving =
      !frameState.viewHints[ViewHint.ANIMATING] &&
      !frameState.viewHints[ViewHint.INTERACTING];
    const extentChanged = !equals(this.previousExtent_, frameState.extent);
    const sourceChanged = this.sourceRevision_ < vectorSource.getRevision();

    if (sourceChanged) {
      this.sourceRevision_ = vectorSource.getRevision();
    }

    if (viewNotMoving && (extentChanged || sourceChanged)) {
      const projection = viewState.projection;
      const resolution = viewState.resolution;

      const renderBuffer =
        layer instanceof BaseVector ? layer.getRenderBuffer() : 0;
      const extent = buffer(frameState.extent, renderBuffer * resolution);
      vectorSource.loadFeatures(extent, resolution, projection);

      this.ready = false;

      const transform = this.helper.makeProjectionTransform(
        frameState,
        createTransform()
      );

      const generatePromises = this.styleRenderers_.map((renderer, i) =>
        renderer.generateBuffers(this.batch_, transform).then((buffers) => {
          this.buffers_[i] = buffers;
        })
      );
      Promise.all(generatePromises).then(() => {
        this.ready = true;
        this.getLayer().changed();
      });

      this.previousExtent_ = frameState.extent.slice();
    }

    return true;
  }

  /**
   * @param {import("../../coordinate").Coordinate} coordinate Coordinate.
   * @param {import("../../Map").FrameState} frameState Frame state.
   * @param {number} hitTolerance Hit tolerance in pixels.
   * @param {import("../vector").FeatureCallback<T>} callback Feature callback.
   * @param {Array<import("../Map").HitMatch<T>>} matches The hit detected matches with tolerance.
   * @return {T|undefined} Callback result.
   * @template T
   */
  forEachFeatureAtCoordinate(
    coordinate,
    frameState,
    hitTolerance,
    callback,
    matches
  ) {
    return undefined;
  }

  /**
   * Clean up.
   */
  disposeInternal() {
    this.sourceListenKeys_.forEach(function (key) {
      unlistenByKey(key);
    });
    this.sourceListenKeys_ = null;
    super.disposeInternal();
  }
}

export default WebGLVectorLayerRenderer;
