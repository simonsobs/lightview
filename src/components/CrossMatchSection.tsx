type CrossMatchSectionProps = {
  crossMatches: { name: string }[];
};

export function CrossMatchSection({ crossMatches }: CrossMatchSectionProps) {
  return (
    <div>
      <h3 className="source-section-h3">Cross-Matches</h3>
      {crossMatches.length ? (
        <ul>
          {crossMatches.map((m) => (
            <li key={m.name}>{m.name}</li>
          ))}
        </ul>
      ) : (
        <h4>
          <em>No results</em>
        </h4>
      )}
    </div>
  );
}
