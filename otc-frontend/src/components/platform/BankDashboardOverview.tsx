import Panel from '../layout/Panel';

export default function BankDashboardOverview({
  overview,
}: {
  overview: {
    institutions: number;
    newRFQs: number;
    activeNegotiations: number;
    awaitingInstitutionDeposit: number;
    awaitingBankDeposit: number;
    readyToSettle: number;
    settlementExceptions: number;
  };
}) {
  const stats = [
    { label: 'Institutions', value: overview.institutions },
    { label: 'New RFQs', value: overview.newRFQs },
    { label: 'Negotiations', value: overview.activeNegotiations },
    { label: 'Awaiting Institution Deposit', value: overview.awaitingInstitutionDeposit },
    { label: 'Awaiting Bank Deposit', value: overview.awaitingBankDeposit },
    { label: 'Ready To Settle', value: overview.readyToSettle },
    { label: 'Exceptions', value: overview.settlementExceptions },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="panel p-4">
            <div className="stat-value">{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>
      <Panel title="Bank Workflow">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            'Overview',
            'Institutions',
            'RFQs',
            'Negotiations',
            'Escrow Monitor',
            'Settlement Operations',
            'User Management',
            'KYB / Policy',
          ].map((section) => (
            <div key={section} className="rounded-lg border border-terminal-border bg-terminal-bg px-4 py-3 font-mono text-xs">
              {section}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
