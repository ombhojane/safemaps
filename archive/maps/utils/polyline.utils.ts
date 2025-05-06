// Function to decode a polyline
export function decodePolyline(encodedPolyline: string): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  let index = 0, lat = 0, lng = 0;

  while (index < encodedPolyline.length) {
    let result = 1;
    let shift = 0;
    let b: number;
    do {
      b = encodedPolyline.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);
    lat += (result & 1) !== 0 ? ~(result >> 1) : (result >> 1);

    result = 1;
    shift = 0;
    do {
      b = encodedPolyline.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);
    lng += (result & 1) !== 0 ? ~(result >> 1) : (result >> 1);

    points.push({ lat: lat * 1e-5, lng: lng * 1e-5 });
  }
  return points;
}

// Function to encode points into a polyline string
export function encodePolyline(points: { lat: number; lng: number }[]): string {
  const encode = (val: number): string => {
    val = Math.round(val * 1e5);
    val = val << 1;
    if (val < 0) {
      val = ~val;
    }
    let result = '';
    while (val >= 0x20) {
      result += String.fromCharCode((0x20 | (val & 0x1f)) + 63);
      val >>= 5;
    }
    result += String.fromCharCode(val + 63);
    return result;
  };

  let result = '';
  let prevLat = 0;
  let prevLng = 0;

  points.forEach(point => {
    result += encode(point.lat - prevLat);
    result += encode(point.lng - prevLng);
    prevLat = point.lat;
    prevLng = point.lng;
  });

  return result;
} 