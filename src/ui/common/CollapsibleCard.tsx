import { useId, useState, type ReactNode } from "react";

type CollapsibleCardProps = {
  title: string;
  defaultExpanded?: boolean;
  sectionId?: string;
  children: ReactNode;
};

export function CollapsibleCard({
  title,
  defaultExpanded = true,
  sectionId,
  children,
}: CollapsibleCardProps) {
  const autoId = useId();
  const panelId = sectionId ?? autoId;
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <section className="collapsible-card">
      <button
        className="collapsible-card__toggle"
        type="button"
        aria-controls={panelId}
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        {title}
      </button>
      {expanded ? (
        <div id={panelId} className="collapsible-card__content">
          {children}
        </div>
      ) : null}
    </section>
  );
}
