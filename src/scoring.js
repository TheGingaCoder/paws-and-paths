export function scoreWalk(walk, route, previousWalk) {
  const activeTimeSeconds = walk?.activeTimeSeconds ?? 0;
  const distanceMeters = walk?.distanceMeters ?? 0;
  const completedCount = Math.max(0, (walk?.completedCheckpointIndex ?? -1) + 1);
  const routeCheckpointCount = route?.checkpoints?.length ?? 0;
  const completedRoute = routeCheckpointCount > 0 && completedCount >= routeCheckpointCount;

  const base = 25;
  const distance = Math.floor(distanceMeters / 100) * 2;
  const checkpoints = completedCount * 12;
  const routeBonus = completedRoute ? 40 : 0;

  let timeBonus = 0;
  let comparison = "First logged walk on this route. A fresh little tradition.";
  if (previousWalk) {
    const differenceSeconds = activeTimeSeconds - previousWalk.activeTimeSeconds;
    if (differenceSeconds > 0) {
      timeBonus = Math.min(60, Math.floor(differenceSeconds / 60) * 5);
      const minutes = Math.round(differenceSeconds / 60);
      comparison = `You spent ${minutes} minute${minutes === 1 ? "" : "s"} longer outside than last time. More sniff time, more enrichment.`;
    } else if (differenceSeconds === 0) {
      comparison = "You matched your previous walk time. Nice consistency.";
    } else {
      comparison = "This walk was shorter than last time, but you still got outside and completed dog business.";
    }
  }

  return {
    xp: base + distance + checkpoints + routeBonus + timeBonus,
    breakdown: { base, distance, checkpoints, routeBonus, timeBonus },
    comparison
  };
}

export function averageCheckpointSeconds(checkpointTimes = []) {
  if (!checkpointTimes.length) return 0;
  const total = checkpointTimes.reduce((sum, item) => sum + item.timeFromPreviousSeconds, 0);
  return Math.round(total / checkpointTimes.length);
}
