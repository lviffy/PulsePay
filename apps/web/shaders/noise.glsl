float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1)),f.x),f.y); }
float bayer(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  float x = q.x, y = q.y;
  float a = mod(x,2.0)*2.0 + mod(y,2.0)*3.0 - mod(x,2.0)*mod(y,2.0)*4.0;
  float b = floor(x/2.0)*2.0 + floor(y/2.0)*3.0 - floor(x/2.0)*floor(y/2.0)*4.0;
  return (a*4.0+b+.5)/16.0;
}
