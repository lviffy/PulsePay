attribute float aRing;
attribute float aGlyph;
attribute float aSlot;
attribute float aCount;
uniform float uTime;
uniform float uScroll;
uniform float uReveal;
uniform vec2 uPointer;
uniform vec2 uResolution;
varying vec2 vUv;
varying float vGlyph;
varying float vAlpha;
void main() {
  float direction = mod(aRing,2.0)*2.0-1.0;
  float theta = 1.5707963-aSlot/aCount*(1.0-uScroll*.025)*6.2831853 + uTime*(.018+aRing*.002)*direction + uScroll*.7*direction;
  float radius = (.56+aRing*.52)*(1.0+uScroll*.55);
  vec2 radial = vec2(cos(theta),sin(theta));
  vec2 tangent = vec2(sin(theta),-cos(theta));
  vec2 center = radial*radius;
  float proximity = exp(-length(center-uPointer)*2.3);
  float wave = sin(theta*5.0-uTime*.8)*.012;
  vec3 p = vec3(center + tangent*position.x*(.17+aRing*.009) + radial*position.y*(.28+aRing*.012+wave), -(9.0-aRing)*.18);
  p.xy += radial*proximity*.12;
  p.z += proximity*.4 + noise(vec2(theta*2.0,aRing+uTime*.1))*.035;
  p.x += uPointer.x*p.z*.025;
  p.y += uPointer.y*p.z*.025;
  vUv=uv; vGlyph=aGlyph; vAlpha=(.94-aRing*.057)*uReveal;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
}
