import Panel from '../../layout/Panel';
import { timeAgo } from '../../../lib/constants';
import type { ActivityEvent } from '../../../lib/otc/types';

interface EscrowTimelineProps {
  events: ActivityEvent[];
}

export default function EscrowTimeline({ events }: EscrowTimelineProps) {
  return (
    <Panel title="Activity">
      {events.length === 0 ? (
        <div className="py-8 text-center font-mono text-sm text-terminal-dim">
          No activity yet for this RFQ.
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <div key={event.id} className="relative pl-5">
              <div className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-terminal-accent" />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-mono text-sm text-terminal-text">{event.summary}</div>
                <div className="font-mono text-[11px] uppercase tracking-wider text-terminal-dim">{timeAgo(event.createdAt)}</div>
              </div>
              <div className="mt-1 font-mono text-xs text-terminal-dim">{event.actorName}</div>
              {event.detail ? (
                <div className="mt-2 font-mono text-xs leading-6 text-terminal-text">{event.detail}</div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
