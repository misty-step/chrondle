type PlayWithCompletion = {
  completedAt?: number;
};

export function isCompletedPlay<T extends PlayWithCompletion>(
  play: T,
): play is T & { completedAt: number } {
  return play.completedAt !== undefined;
}
