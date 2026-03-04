import { useId, useState, type ReactNode } from "react";

type CollapsibleCardProps = {
  title: string;
  defaultExpanded?: boolean;
  sectionId?: string;
  headerActions?: ReactNode;
  children: ReactNode;
};

export function CollapsibleCard({
  title,
  defaultExpanded = true,
  sectionId,
  headerActions,
  children
}: CollapsibleCardProps) {
  const autoId = useId();
  const panelId = sectionId ?? autoId;
  const toggleId = `${panelId}-toggle`;
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <section className="collapsible-card">
      <div className="collapsible-card__header">
        <button
          id={toggleId}
          className="collapsible-card__toggle"
          type="button"
          aria-controls={panelId}
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {title}
        </button>
        {headerActions && (
          <div className="collapsible-card__header-actions">
            {headerActions}
          </div>
        )}
      </div>
      <div
        id={panelId}
        className="collapsible-card__content"
        role="region"
        aria-labelledby={toggleId}
        hidden={!expanded}
        aria-hidden={!expanded}
      >
        {children}
      </div>
    </section>
  );
}
