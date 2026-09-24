// Results unlock when everyone has submitted OR the deadline has passed.
export function shouldTrigger(args: {
  submittedCount: number;
  participantCount: number;
  deadline: Date;
  now: Date;
}): boolean {
  const allIn =
    args.participantCount > 0 && args.submittedCount >= args.participantCount;
  return allIn || args.now.getTime() >= args.deadline.getTime();
}
