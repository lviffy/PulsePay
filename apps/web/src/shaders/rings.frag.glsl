uniform sampler2D uAtlas;
varying vec2 vUv;
varying float vGlyph;
varying float vAlpha;
void main() {
  vec2 cell=vec2(mod(vGlyph,16.0),floor(vGlyph/16.0));
  vec2 atlasUv=(cell+vec2(vUv.x,1.0-vUv.y))/vec2(16.0,6.0);
  float alpha=texture2D(uAtlas,atlasUv).a*vAlpha;
  if(alpha<.1) discard;
  gl_FragColor=vec4(vec3(.945,.937,.906),alpha);
}
