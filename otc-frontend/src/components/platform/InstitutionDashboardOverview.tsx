import Panel from '../layout/Panel';

export default function InstitutionDashboardOverview({
  overview,
}: {
  overview: {
    myRFQs: number;
    activeNegotiations: number;
    awaitingMyDeposit: number;
    settlementHistory: number;
    pendingPolicy: number;
    teamMembers: number;
  };
}) {
  const stats = [
    { label: 'My RFQs', value: overview.myRFQs },
    { label: 'Negotiations', value: overview.activeNegotiations },
    { label: 'Awaiting My Deposit', value: overview.awaitingMyDeposit },
    { label: 'Settlement History', value: overview.settlementHistory },
    { label: 'Pending Policy', value: overview.pendingPolicy },
    { label: 'Team Members', value: overview.teamMembers },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="panel p-4">
            <div className="stat-value">{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>
      <Panel title="Institution Workflow">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {['My RFQs', 'Create RFQ', 'Negotiations', 'Escrow Status', 'Settlement History'].map((section) => (
            <div key={section} className="rounded-lg border border-terminal-border bg-terminal-bg px-4 py-3 font-mono text-xs">
              {section}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
