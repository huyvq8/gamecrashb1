import type { CrashHistoryItem } from './useCrashUiModel';

interface Props {
  items: CrashHistoryItem[];
  expanded: boolean;
  onToggleExpanded: () => void;
}

export function CrashHistory({ items, expanded, onToggleExpanded }: Props) {
  return (
    <section className="crash-history">
      <div className="history-row">
        {items.map((item, idx) => (
          <span key={`${item.display}-${idx}`} className={`tier-${item.tier}`}>
            {item.display}
          </span>
        ))}
      </div>
      <button onClick={onToggleExpanded}>{expanded ? 'Less' : 'More'}</button>
    </section>
  );
}
