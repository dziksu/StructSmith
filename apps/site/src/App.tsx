import {
  ArrowRight,
  Blocks,
  Bot,
  Check,
  Database,
  GitFork as Github,
  GitPullRequest,
  Layers3,
  LockKeyhole,
  MonitorCog,
  Network,
  ScanLine,
  Sparkles,
  Terminal,
} from "lucide-react";

const githubUrl = "https://github.com/dziksu/StructSmith";

type AppProps = {
  baseUrl?: string;
};

function ArchitectureCanvas() {
  return (
    <div
      className="architecture-demo"
      role="img"
      aria-label="An animated StructSmith architecture model being assembled"
    >
      <div className="demo-toolbar">
        <span>
          <i className="status-dot" /> Container view
        </span>
        <span className="demo-revision">revision 28</span>
      </div>
      <div className="demo-canvas">
        <svg
          className="demo-edges"
          viewBox="0 0 680 400"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path className="edge edge-one" d="M150 157 C205 157 210 87 250 87" />
          <path className="edge edge-two" d="M398 87 C454 87 468 47 532 47" />
          <path className="edge edge-three edge-async" d="M398 87 C470 87 466 195 532 195" />
          <path className="edge edge-four" d="M398 87 C474 87 466 339 532 339" />
        </svg>
        <div className="arch-node person-node">
          <i className="node-port node-port-out" />
          <span className="node-icon">P</span>
          <strong>Product team</strong>
          <small>PERSON</small>
        </div>
        <div className="arch-node system-node">
          <i className="node-port node-port-in" />
          <i className="node-port node-port-out" />
          <span className="node-icon">S</span>
          <strong>StructSmith</strong>
          <span>Architecture workspace</span>
          <small>SOFTWARE SYSTEM</small>
        </div>
        <div className="arch-node api-node">
          <i className="node-port node-port-in" />
          <span className="node-icon">A</span>
          <strong>REST API</strong>
          <small>CONTAINER · BUN</small>
        </div>
        <div className="arch-node mcp-node">
          <i className="node-port node-port-in" />
          <span className="node-icon">M</span>
          <strong>MCP server</strong>
          <small>CONTAINER · HTTP</small>
        </div>
        <div className="arch-node db-node">
          <i className="node-port node-port-in" />
          <span className="node-icon">D</span>
          <strong>Model store</strong>
          <small>CONTAINER · SQLITE</small>
        </div>
        <span className="edge-label label-one">models architecture</span>
        <span className="edge-label label-two">same domain model</span>
        <div className="model-event">
          <span>+</span> relationship created
        </div>
      </div>
      <div className="demo-footer">
        <span>5 elements</span>
        <span>4 relationships</span>
        <span className="mcp-live">
          <i /> MCP connected
        </span>
      </div>
    </div>
  );
}

export function App({ baseUrl = "/" }: AppProps) {
  return (
    <main>
      <nav className="site-nav" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="StructSmith home">
          <img src={`${baseUrl}logo.png`} alt="" />
          <span>StructSmith</span>
        </a>
        <div className="nav-links">
          <a href="#why">Why StructSmith</a>
          <a href="#mcp">MCP</a>
          <a href="#start">Quick start</a>
          <a className="github-link" href={githubUrl} target="_blank" rel="noreferrer">
            <Github aria-hidden="true" /> GitHub
          </a>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow">
            <span /> Open source · local-first · MCP-native
          </div>
          <h1>
            Architecture that stays useful <em>after the workshop.</em>
          </h1>
          <p>
            The open-source, self-hosted alternative to paid architecture tools. Model software
            systems with people and AI on the same source of truth — without accounts, cloud
            lock-in, or diagrams that drift away from reality.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#start">
              Run StructSmith <ArrowRight />
            </a>
            <a
              className="button button-secondary"
              href={githubUrl}
              target="_blank"
              rel="noreferrer"
            >
              <Github /> View source
            </a>
          </div>
          <div className="hero-proof">
            <span>
              <strong>1</strong> container
            </span>
            <span>
              <strong>1</strong> SQLite file
            </span>
            <span>
              <strong>0</strong> telemetry
            </span>
          </div>
        </div>
        <ArchitectureCanvas />
      </section>

      <section className="model-strip" aria-label="One model shared by every interface">
        <p>One semantic model. Every way of working.</p>
        <div className="model-strip-flow">
          <span>
            <MonitorCog /> Visual editor
          </span>
          <i />
          <span>
            <Terminal /> REST API
          </span>
          <i />
          <span>
            <Sparkles /> AI via MCP
          </span>
          <b>→</b>
          <strong>
            <Database /> Domain model + SQLite
          </strong>
        </div>
      </section>

      <section className="product-section section-shell" id="why">
        <div className="section-heading split-heading">
          <div>
            <span className="section-kicker">Not another drawing canvas</span>
            <h2>
              Your diagram is a view.
              <br />
              The model is the truth.
            </h2>
          </div>
          <p>
            Every element, relationship, boundary and view remains structured. Change the model in
            the editor, through REST, or with an AI assistant — the architecture stays consistent
            everywhere.
          </p>
        </div>

        <div className="product-frame">
          <div className="browser-chrome">
            <div className="traffic-lights">
              <i />
              <i />
              <i />
            </div>
            <span>StructSmith / System context</span>
            <span className="browser-status">
              <i /> MCP
            </span>
          </div>
          <img
            src={`${baseUrl}screen_01.png`}
            alt="StructSmith system context diagram in the visual editor"
          />
          <div className="frame-callout callout-model">
            <Network />
            <span>
              <strong>Semantic by design</strong>Elements are more than boxes
            </span>
          </div>
          <div className="frame-callout callout-sync">
            <ScanLine />
            <span>
              <strong>Always in sync</strong>AI changes appear live
            </span>
          </div>
        </div>
      </section>

      <section className="feature-section section-shell">
        <div className="section-heading compact-heading">
          <span className="section-kicker">
            A practical alternative to paid architecture suites
          </span>
          <h2>
            Enough structure to stay useful.
            <br />
            Light enough to keep using.
          </h2>
        </div>

        <div className="feature-grid">
          <article className="feature-card feature-card-wide model-card">
            <div className="feature-icon">
              <Layers3 />
            </div>
            <div>
              <h3>Model systems, not slides</h3>
              <p>
                C4-inspired elements, typed relationships, boundaries, views and presets live in one
                validated workspace.
              </p>
            </div>
            <div className="mini-stack" aria-hidden="true">
              <div>
                <span>01</span>System context<i>7 elements</i>
              </div>
              <div>
                <span>02</span>Containers<i>12 elements</i>
              </div>
              <div>
                <span>03</span>Deployment<i>8 elements</i>
              </div>
            </div>
          </article>

          <article className="feature-card local-card">
            <div className="feature-icon">
              <LockKeyhole />
            </div>
            <h3>Local means local</h3>
            <p>
              No account, cloud dependency or telemetry. One container and one SQLite file keep
              ownership simple.
            </p>
            <div className="local-proof" aria-hidden="true">
              <span>
                <Check /> No sign-up
              </span>
              <span>
                <Check /> Offline-ready
              </span>
              <span>
                <Check /> MIT licensed
              </span>
            </div>
          </article>

          <article className="feature-card collaboration-card">
            <div className="feature-icon">
              <GitPullRequest />
            </div>
            <h3>Change without fear</h3>
            <p>
              Revision guards, automatic snapshots and operation previews make larger model changes
              reviewable.
            </p>
            <div className="revision-track" aria-hidden="true">
              <i>26</i>
              <span />
              <i>27</i>
              <span />
              <i className="active-rev">28</i>
            </div>
          </article>

          <article className="feature-card feature-card-wide mcp-card" id="mcp">
            <div className="mcp-copy">
              <div className="feature-icon">
                <Bot />
              </div>
              <h3>AI works on the architecture — not a screenshot</h3>
              <p>
                The built-in MCP server gives Codex, Claude, Copilot and other clients the same
                validated tools the UI uses. Inspect, model, review and document without translating
                the system into chat.
              </p>
              <a
                href={`${githubUrl}/blob/main/docs/AI_CLIENTS.md`}
                target="_blank"
                rel="noreferrer"
              >
                Connect your AI client <ArrowRight className="mcp-link-icon" />
              </a>
            </div>
            <div className="mcp-terminal">
              <div className="terminal-top">
                <span>
                  <i />
                  <i />
                  <i />
                </span>
                <b>AI client · StructSmith MCP</b>
              </div>
              <div className="terminal-line user-line">
                <span>you</span>Add a notification worker and connect it to the API.
              </div>
              <div className="terminal-line tool-line">
                <span>tool</span>model_apply_operations
              </div>
              <div className="terminal-result">
                <span>
                  <Check className="terminal-result-icon" /> 3 operations applied
                </span>
                <code>revision 28 → 29</code>
              </div>
              <div className="terminal-line assistant-line">
                <span>ai</span>The worker, queue relationship and container view are updated.
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="workflow-section section-shell">
        <div className="section-heading workflow-heading">
          <span className="section-kicker">A shared architecture loop</span>
          <h2>Think together. Change once. See it everywhere.</h2>
        </div>
        <div className="workflow-grid">
          <article>
            <span className="workflow-step">01</span>
            <Blocks className="workflow-icon" />
            <h3>Shape the model</h3>
            <p>
              Capture people, systems, containers and the relationships that make the design
              understandable.
            </p>
          </article>
          <article>
            <span className="workflow-step">02</span>
            <Bot className="workflow-icon" />
            <h3>Explore with AI</h3>
            <p>
              Ask for risks, unknowns, alternatives or a complete model update through structured
              MCP tools.
            </p>
          </article>
          <article>
            <span className="workflow-step">03</span>
            <Network className="workflow-icon" />
            <h3>Share the right view</h3>
            <p>
              Create system context, container and tailored stakeholder views from the same source
              of truth.
            </p>
          </article>
        </div>
      </section>

      <section className="start-section section-shell" id="start">
        <div className="start-copy">
          <span className="section-kicker">Up in under a minute</span>
          <h2>
            Your architecture workspace,
            <br />
            without the platform tax.
          </h2>
          <p>
            Run the published image locally. Your model persists in a Docker volume and never leaves
            your machine.
          </p>
          <div className="start-points">
            <span className="start-point">
              <Check className="start-check" /> Single command
            </span>
            <span className="start-point">
              <Check className="start-check" /> No configuration required
            </span>
            <span className="start-point">
              <Check className="start-check" /> Works fully offline
            </span>
          </div>
        </div>
        <div className="install-panel">
          <div className="install-tabs">
            <span className="install-tab-active">
              <Terminal className="install-tab-icon" /> Docker
            </span>
            <span>localhost:8090</span>
          </div>
          <pre>
            <code>
              <span>$</span>{" "}
              {`docker run -d --name structsmith \\
  -p 127.0.0.1:8090:8080 \\
  -v structsmith-data:/data \\
  ghcr.io/dziksu/structsmith:latest`}
            </code>
          </pre>
          <div className="install-ready">
            <i />
            <span className="install-ready-copy">
              <strong>StructSmith is ready</strong>Open http://localhost:8090
            </span>
          </div>
          <a
            className="button button-primary install-button"
            href={`${githubUrl}#quick-start`}
            target="_blank"
            rel="noreferrer"
          >
            Read the quick start <ArrowRight />
          </a>
        </div>
      </section>

      <section className="final-cta section-shell">
        <div className="cta-mark" aria-hidden="true">
          <Network className="cta-icon" />
        </div>
        <h2>Make architecture a living part of the work.</h2>
        <p>Open source, self-hosted and ready to collaborate with your AI client.</p>
        <div className="hero-actions">
          <a
            className="button button-primary"
            href={`${githubUrl}#quick-start`}
            target="_blank"
            rel="noreferrer"
          >
            Start locally <ArrowRight />
          </a>
          <a className="button button-secondary" href={githubUrl} target="_blank" rel="noreferrer">
            <Github /> Star on GitHub
          </a>
        </div>
      </section>

      <footer className="site-footer section-shell">
        <a className="brand" href="#top">
          <img src={`${baseUrl}logo.png`} alt="" />
          <span>StructSmith</span>
        </a>
        <p>Model, document and share software architecture — locally, and with your AI client.</p>
        <div>
          <a href={`${githubUrl}/blob/main/LICENSE`} target="_blank" rel="noreferrer">
            MIT License
          </a>
          <a href={`${githubUrl}/releases`} target="_blank" rel="noreferrer">
            Releases
          </a>
          <a href={githubUrl} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
      </footer>
    </main>
  );
}
