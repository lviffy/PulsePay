uniform sampler2D uAtlas;
uniform sampler2D uText;
uniform sampler2D uHealing;
uniform float uTime;
uniform float uReveal;
uniform vec2 uResolution;
varying vec2 vUv;
void main(){
  vec2 grid=floor(uResolution/vec2(10.0,15.0));
  vec2 cell=floor(vUv*grid);
  vec2 local=fract(vUv*grid);
  float luminance=texture2D(uText,(cell+.5)/grid).r;
  float cloud=noise(cell*.025+vec2(uTime*.015,0.0));
  float disturbance=texture2D(uHealing,vUv).r;
  float scramble=max(1.0-uReveal,disturbance);
  float glyph=floor(mix(1.0+luminance*18.0,hash21(cell+floor(uTime*12.0))*94.0,scramble));
  vec2 glyphUv=(vec2(mod(glyph,16.0),floor(glyph/16.0))+vec2(local.x,1.0-local.y))/vec2(16.0,6.0);
  float ink=texture2D(uAtlas,glyphUv).a;
  float density=luminance*.8+cloud*.18+disturbance*.4;
  float threshold=bayer(cell);
  float coverageMask=step(threshold,density);
  vec3 cream=vec3(.945,.937,.906), dark=vec3(.125,.125,.118);
  gl_FragColor=vec4(mix(cream,dark,ink*coverageMask*.65),1.0);
}
