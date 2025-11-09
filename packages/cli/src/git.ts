export const sampleCommits = (commits: string[], maxFrames: number): string[] => {
  if (commits.length <= maxFrames) {
    return commits;
  }

  const frameCount = Math.max(1, maxFrames);
  const lastIndex = commits.length - 1;
  const indices = new Set<number>();

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const index = Math.floor((frameIndex * lastIndex) / Math.max(frameCount - 1, 1));
    indices.add(Math.min(index, lastIndex));
  }
  indices.add(lastIndex);

  return Array.from(indices)
    .sort((a, b) => a - b)
    .map((index) => commits[index]);
};

