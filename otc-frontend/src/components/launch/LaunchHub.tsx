import Panel from '../layout/Panel';

interface LaunchHubProps {
  onChooseRFQ: () => void;
  onChooseLQ: () => void;
}

export default function LaunchHub({ onChooseRFQ, onChooseLQ }: LaunchHubProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Panel title="Launch">
        <div className="space-y-1 px-2 py-2 font-mono leading-6 text-terminal-dim">
          <div className="text-xs uppercase tracking-[0.3em] text-terminal-accent">Choose Your Path</div>
          <div className="text-lg text-terminal-text">How would you like to use ContraClear?</div>
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
              I want to <span className="text-terminal-accent">request for quote</span>
            </div>
            <p className="font-mono text-xs leading-6 text-terminal-dim">
              Compose your RFQ: pair, size, expiry. Sign in at submit.
            </p>
            <div className="pt-2">
              <span className="btn-primary inline-flex">Create An RFQ →</span>
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
              I want to <span className="text-terminal-accent">provide liquidity</span>
            </div>
            <p className="font-mono text-xs leading-6 text-terminal-dim">
              Browse open RFQs. Sign in and connect a wallet to quote.
            </p>
            <div className="pt-2">
              <span className="btn-primary inline-flex">Browse Open RFQs →</span>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
