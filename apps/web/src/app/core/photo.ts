/* Photos are evidence. A phase cannot close without one. The file from the camera is
   shrunk to at most 1200px on its long side and stored as JPEG, so a job with twelve
   photos stays under a megabyte. Live mode uploads the same bytes to Storage and keeps
   the URL; the demo keeps them in this browser. */
export function shrink(file: File, max = 1200, quality = .82): Promise<string> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('not an image')); };
    img.src = url;
  });
}
/* the demo has no camera in a desktop browser: draw an honest placeholder that says
   what it is, with the plate and the phase, so a demo photo can never pass as a real one */
export function demoPhoto(plate: string, phase: string, dark = true): string {
  const c = document.createElement('canvas'); c.width = 960; c.height = 720; const x = c.getContext('2d')!;
  x.fillStyle = dark ? '#1b1c20' : '#e9e9ec'; x.fillRect(0, 0, c.width, c.height);
  x.strokeStyle = dark ? '#2c2d33' : '#d3d3d8'; x.lineWidth = 2; for (let i = 0; i < 12; i++) { x.beginPath(); x.moveTo(0, i * 64); x.lineTo(960, i * 64 + 180); x.stroke(); }
  x.fillStyle = dark ? '#c9dd2b' : '#5f6a12'; x.font = '600 34px Inter, system-ui, sans-serif'; x.fillText('DEMO PHOTO', 48, 88);
  x.fillStyle = dark ? '#f2f2f4' : '#141417'; x.font = '700 72px Inter, system-ui, sans-serif'; x.fillText(plate, 48, 380);
  x.font = '500 40px Inter, system-ui, sans-serif'; x.fillStyle = dark ? '#a5a7ae' : '#4b4c52'; x.fillText(phase, 48, 450);
  x.font = '400 26px Inter, system-ui, sans-serif'; x.fillText(new Date().toLocaleString('en-GB'), 48, 660);
  return c.toDataURL('image/jpeg', .7);
}
