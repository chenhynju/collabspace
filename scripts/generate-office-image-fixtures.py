"""Deterministic synthetic PNGs for upload diagnostics; Python standard library only."""
import os
import random
import struct
import zlib

root = '.test-runs/ppt-image-profile'
os.makedirs(root, exist_ok=True)


def chunk(kind, data):
    return (struct.pack('>I', len(data)) + kind + data
            + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff))


for name, width, height, noise in [('small', 640, 360, False), ('large', 1920, 1080, True)]:
    rng = random.Random(20261025)
    rows = []
    for y in range(height):
        data = (rng.randbytes(width * 3) if noise else bytes(
            value for x in range(width) for value in (
                (x * 255 // width + rng.randrange(6)) % 256,
                (y * 255 // height + rng.randrange(6)) % 256,
                160 + rng.randrange(6))))
        rows.append(b'\x00' + data)
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(b''.join(rows), 6)) + chunk(b'IEND', b''))
    with open(os.path.join(root, name + '.png'), 'wb') as output:
        output.write(png)
    print(name, width, height, len(png))
