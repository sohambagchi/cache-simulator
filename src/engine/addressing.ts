export type DecodeAddressInput = {
  address: number;
  offsetBits: number;
  indexBits: number;
};

export type DecodedAddress = {
  tag: number;
  index: number;
  offset: number;
};

function bitMask(bits: number): number {
  if (bits <= 0) {
    return 0;
  }

  return (1 << bits) - 1;
}

export function decodeAddress(input: DecodeAddressInput): DecodedAddress {
  const offset = input.address & bitMask(input.offsetBits);
  const index = (input.address >>> input.offsetBits) & bitMask(input.indexBits);
  const tag = input.address >>> (input.offsetBits + input.indexBits);

  return { tag, index, offset };
}

export function encodeAddress(params: {
  tag: number;
  index: number;
  offset: number;
  offsetBits: number;
  indexBits: number;
}): number {
  return (
    (params.tag << (params.indexBits + params.offsetBits)) |
    (params.index << params.offsetBits) |
    params.offset
  );
}
