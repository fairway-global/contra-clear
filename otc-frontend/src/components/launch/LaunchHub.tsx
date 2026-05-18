import Panel from '../layout/Panel';

interface LaunchHubProps {
  onChooseRFQ: () => void;
  onChooseLQ: () => void;
}

export default function LaunchHub({ onChooseRFQ, onChooseLQ }: LaunchHubProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Panel title="Launch">
        <div className="space-y-2 px-2 py-2 font-mono text-sm leading-6 text-terminal-dim">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-terminal-accent">Choose Your Path</div>
          <div className="text-terminal-text text-lg">
            How would you like to use ContraClear?
          </div>
          <div>
            Browse and configure freely. Login, KYC, and wallet connection are only needed at the moment you act —
            submit an RFQ or send a quote.
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={onChooseRFQ}
          className="panel group block text-left transition-colors hover:border-terminal-accent"
        >
          <div className="panel-header">
            <span className="panel-title">Create RFQ</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-terminal-accent">
              For Originators
            </span>
          </div>
          <div className="space-y-4 p-5">
            <div className="font-mono text-2xl text-terminal-text group-hover:text-terminal-accent">
              I want to <span className="text-terminal-accent">request liquidity</span>
            </div>
            <p className="font-mono text-xs leading-6 text-terminal-dim">
              Build a structured RFQ — pick the pair, size, indicative price, expiry, and counterparty tier. Sign in only
              when you are ready to submit it to approved traders.
            </p>
            <ul className="space-y-2 font-mono text-[11px] text-terminal-dim">
              <li className="flex items-start gap-2"><span className="text-terminal-accent">›</span> Compose privately before committing</li>
              <li className="flex items-start gap-2"><span className="text-terminal-accent">›</span> No login until you click Create</li>
              <li className="flex items-start gap-2"><span className="text-terminal-accent">›</span> KYC completes after the request is captured</li>
            </ul>
            <div className="pt-2">
              <span className="btn-primary inline-flex">Compose An RFQ →</span>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={onChooseLQ}
          className="panel group block text-left transition-colors hover:border-terminal-accent"
        >
          <div className="panel-header">
            <span className="panel-title">Provide Liquidity</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-terminal-accent">
              For Approved Traders
            </span>
          </div>
          <div className="space-y-4 p-5">
            <div className="font-mono text-2xl text-terminal-text group-hover:text-terminal-accent">
              I want to <span className="text-terminal-accent">propose a quote</span>
            </div>
            <p className="font-mono text-xs leading-6 text-terminal-dim">
              Browse every open RFQ — pair, size, originator, expiry — and open any thread for full detail. Login and
              wallet connection are required only when you submit a quote.
            </p>
            <ul className="space-y-2 font-mono text-[11px] text-terminal-dim">
              <li className="flex items-start gap-2"><span className="text-terminal-accent">›</span> Public read access to open RFQs</li>
              <li className="flex items-start gap-2"><span className="text-terminal-accent">›</span> No login or wallet to read the desk</li>
              <li className="flex items-start gap-2"><span className="text-terminal-accent">›</span> Auth and wallet kick in at Propose Quote</li>
            </ul>
            <div className="pt-2">
              <span className="btn-primary inline-flex">Browse Open RFQs →</span>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
