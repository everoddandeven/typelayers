/**
 * @module tl/webgl/PaletteTexture
 */

class PaletteTexture {
  /**
   * @param {string} name The name of the texture.
   * @param {Uint8Array} data The texture data.
   */

  private texture_: WebGLTexture;

  public name: string;
  public data: Uint8Array;

  constructor(name: string, data: Uint8Array) {
    this.name = name;
    this.data = data;

    /**
     * @type {WebGLTexture}
     * @private
     */
    this.texture_ = null;
  }

  /**
   * @param {WebGLRenderingContext} gl Rendering context.
   * @return {WebGLTexture} The texture.
   */
  public getTexture(gl: WebGLRenderingContext): WebGLTexture {
    if (!this.texture_) {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        this.data.length / 4,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        this.data
      );
      this.texture_ = texture;
    }
    return this.texture_;
  }
}

export default PaletteTexture;
