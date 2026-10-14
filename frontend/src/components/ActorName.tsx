/** BIGINT wire ID는 문자열로 유지하고 NULL 감사 주체만 기본 사용자로 표시한다. */
export function actorName(actor: string | null | undefined): string {
  return actor == null ? "기본 사용자" : actor;
}

export function ActorName({ actor }: { actor: string | null | undefined }) {
  return <>{actorName(actor)}</>;
}

export default ActorName;
