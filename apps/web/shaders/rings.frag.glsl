uniform sampler2D uAtlas;
uniform float uScroll;
uniform vec2 uResolution;
varying vec2 vUv;
varying float vGlyph;
varying float vAlpha;
void main() {
  vec2 cell=vec2(mod(vGlyph,16.0),floor(vGlyph/16.0));
  vec2 atlasUv=(cell+vec2(vUv.x,1.0-vUv.y))/vec2(16.0,6.0);
  float alpha=texture2D(uAtlas,atlasUv).a*vAlpha;
  float rise=clamp(uScroll*1.4-gl_FragCoord.y/uResolution.y,0.0,1.0);
  if(alpha<.1 || rise>bayer(gl_FragCoord.xy/2.0)) discard;
  gl_FragColor=vec4(vec3(.945,.937,.906),alpha);
}
