const formats = {
  'image/jpeg':{
    extension:'.jpg',
    matches:buffer => buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8
      && buffer.at(-2) === 0xff && buffer.at(-1) === 0xd9,
  },
  'image/png':{
    extension:'.png',
    matches:buffer => buffer.length >= 33
      && buffer.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))
      && buffer.readUInt32BE(8) === 13
      && buffer.subarray(12,16).toString('ascii') === 'IHDR'
      && buffer.readUInt32BE(16) > 0 && buffer.readUInt32BE(20) > 0,
  },
  'image/webp':{
    extension:'.webp',
    matches:buffer => buffer.length >= 30
      && buffer.subarray(0,4).toString('ascii') === 'RIFF'
      && buffer.subarray(8,12).toString('ascii') === 'WEBP'
      && ['VP8 ','VP8L','VP8X'].includes(buffer.subarray(12,16).toString('ascii'))
      && buffer.readUInt32LE(4) + 8 <= buffer.length,
  },
};

export const profileImageMimeTypes = new Set(Object.keys(formats));

export function verifyProfileImage(file) {
  const format = formats[file?.mimetype];
  if (!format || !Buffer.isBuffer(file.buffer) || !format.matches(file.buffer)) {
    const error = new Error('The selected file is not a valid JPEG, PNG, or WebP image.');
    error.code = 'INVALID_PROFILE_IMAGE';
    throw error;
  }
  return { mimeType:file.mimetype,extension:format.extension };
}
