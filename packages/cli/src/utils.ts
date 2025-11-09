export const ensurePngPath = (outputPath: string): `${string}.png` => {
  if (outputPath.toLowerCase().endsWith('.png')) {
    return outputPath as `${string}.png`;
  }
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  return `${outputPath}.png` as `${string}.png`;
};

export const ensureMp4Path = (outputPath: string): `${string}.mp4` => {
  if (outputPath.toLowerCase().endsWith('.mp4')) {
    return outputPath as `${string}.mp4`;
  }
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  return `${outputPath}.mp4` as `${string}.mp4`;
};

